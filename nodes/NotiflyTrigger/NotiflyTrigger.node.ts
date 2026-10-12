import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { getWorkflows } from '../Notifly/listSearch';
import { CHANNEL_OPTIONS } from '../Notifly/resources/notification';
import { notiflyApiRequest } from '../Notifly/shared/transport';
import { simplifyNotification } from '../Notifly/shared/utils';

/** Page size of GET /v1/notifications (the API maximum). */
const PAGE_SIZE = 50;
/** Upper bound of pages fetched in one poll, so a large backlog cannot stall the trigger. */
const MAX_PAGES_PER_POLL = 20;
/** How many already-emitted notification IDs to remember for de-duplication. */
const SEEN_IDS_LIMIT = 500;

interface PollState extends IDataObject {
	cursor?: string;
	seenIds?: string[];
}

interface NotificationRecord extends IDataObject {
	_id: string;
	createdAt?: string;
}

interface NotificationListResponse {
	data?: NotificationRecord[];
	hasMore?: boolean;
}

function toStringList(value: unknown): string[] {
	return String(value ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function createdAtMs(notification: NotificationRecord): number {
	const time = Date.parse(notification.createdAt ?? '');
	return Number.isNaN(time) ? 0 : time;
}

export class NotiflyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Notifly Trigger',
		name: 'notiflyTrigger',
		icon: { light: 'file:../../icons/notifly.svg', dark: 'file:../../icons/notifly.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'New Notification Event',
		description: 'Starts the workflow when Notifly creates a new notification',
		defaults: {
			name: 'Notifly Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'notiflyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				default: 'newNotification',
				options: [
					{
						name: 'New Notification Event',
						value: 'newNotification',
						description:
							'Triggers when a workflow is triggered for a subscriber and a notification is created',
					},
				],
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'Channels',
						name: 'channels',
						type: 'multiOptions',
						default: [],
						options: CHANNEL_OPTIONS,
						description: 'Only trigger for notifications sent through these channels',
					},
					{
						displayName: 'Subscriber IDs',
						name: 'subscriberIds',
						type: 'string',
						default: '',
						placeholder: 'e.g. user-123, user-456',
						description: 'Comma-separated list of subscriber IDs to watch',
					},
					{
						displayName: 'Topic Key',
						name: 'topicKey',
						type: 'string',
						default: '',
						placeholder: 'e.g. product-updates',
						description: 'Only trigger for notifications sent to this topic',
					},
					{
						displayName: 'Workflow Names or IDs',
						name: 'templates',
						type: 'multiOptions',
						default: [],
						typeOptions: { loadOptionsMethod: 'getWorkflows' },
						description:
							'Only trigger for notifications from these workflows. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
				],
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
			},
		],
	};

	methods = {
		loadOptions: {
			getWorkflows,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const state = this.getWorkflowStaticData('node') as PollState;
		const filters = this.getNodeParameter('filters', {}) as IDataObject;
		const simplify = this.getNodeParameter('simplify', true) as boolean;
		const isManual = this.getMode() === 'manual';
		const pollStartedAt = new Date().toISOString();

		const qs: IDataObject = { limit: PAGE_SIZE };
		if (Array.isArray(filters.channels) && filters.channels.length > 0) {
			qs.channels = filters.channels;
		}
		if (Array.isArray(filters.templates) && filters.templates.length > 0) {
			qs.templates = filters.templates;
		}
		const subscriberIds = toStringList(filters.subscriberIds);
		if (subscriberIds.length > 0) {
			qs.subscriberIds = subscriberIds;
		}
		if (filters.topicKey) {
			qs.topicKey = filters.topicKey;
		}

		// First activation: start watching from now, without replaying history.
		if (!isManual && !state.cursor) {
			state.cursor = pollStartedAt;
			state.seenIds = [];
			return null;
		}

		const collected: NotificationRecord[] = [];
		try {
			if (isManual) {
				// Manual test run: return the most recent notification so the user can map its fields.
				const response = (await notiflyApiRequest.call(this, 'GET', '/v1/notifications', {
					...qs,
					limit: 1,
					page: 0,
				})) as NotificationListResponse;
				collected.push(...(response.data ?? []));
			} else {
				qs.after = state.cursor;
				for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
					const response = (await notiflyApiRequest.call(this, 'GET', '/v1/notifications', {
						...qs,
						page,
					})) as NotificationListResponse;
					collected.push(...(response.data ?? []));
					if (!response.hasMore) break;
				}
			}
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject, {
				message: 'Could not fetch notifications from Notifly',
				description:
					'Check that the credential secret key is valid and that the Base URL points to your Notifly API.',
			});
		}

		if (isManual) {
			if (collected.length === 0) {
				return null;
			}
			return [
				this.helpers.returnJsonArray(
					collected.map((n) => (simplify ? simplifyNotification(n) : n)),
				),
			];
		}

		const seen = new Set(state.seenIds ?? []);
		const fresh = collected
			.filter((notification) => notification._id && !seen.has(notification._id))
			.sort((a, b) => createdAtMs(a) - createdAtMs(b));

		// Advance the cursor to the newest notification seen. Keep the IDs of recent ones so
		// notifications sharing the cursor timestamp are not emitted twice on the next poll.
		const newest = fresh.length > 0 ? fresh[fresh.length - 1].createdAt : undefined;
		if (newest) {
			state.cursor = newest;
		}
		state.seenIds = [...(state.seenIds ?? []), ...fresh.map((n) => n._id)].slice(-SEEN_IDS_LIMIT);

		if (fresh.length === 0) {
			return null;
		}

		return [
			this.helpers.returnJsonArray(fresh.map((n) => (simplify ? simplifyNotification(n) : n))),
		];
	}
}

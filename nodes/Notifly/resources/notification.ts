import type { INodeProperties } from 'n8n-workflow';
import { pagePagination, returnAllAndLimit, simplifyField } from '../shared/descriptions';
import { simplifyNotification, simplifyOutput } from '../shared/utils';

const showForNotification = { resource: ['notification'] };
const PAGE_SIZE = 50;

export const CHANNEL_OPTIONS = [
	{ name: 'Chat', value: 'chat' },
	{ name: 'Email', value: 'email' },
	{ name: 'In-App', value: 'in_app' },
	{ name: 'Push', value: 'push' },
	{ name: 'SMS', value: 'sms' },
];

const toListExpression =
	'={{ String($value).split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0) }}';

export const notificationDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForNotification },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get notification',
				description: 'Retrieve a notification with its delivery steps and their status',
				routing: {
					request: {
						method: 'GET',
						url: '=/v1/notifications/{{ encodeURIComponent($parameter.notificationId) }}',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'data' } },
							simplifyOutput(simplifyNotification),
						],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many notifications',
				description: 'Retrieve notification activity, newest first',
				routing: {
					request: { method: 'GET', url: '/v1/notifications' },
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'data' } },
							simplifyOutput(simplifyNotification),
						],
					},
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName: 'Notification ID',
		name: 'notificationId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 6a6ca1d0e1f2a3b4c5d6e7f8',
		description: 'The ID of the notification, as returned by Get Many or the Notifly Trigger',
		displayOptions: { show: { resource: ['notification'], operation: ['get'] } },
	},

	...returnAllAndLimit(
		{ resource: ['notification'], operation: ['getAll'] },
		PAGE_SIZE,
		pagePagination(PAGE_SIZE),
	),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['notification'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Channels',
				name: 'channels',
				type: 'multiOptions',
				default: [],
				options: CHANNEL_OPTIONS,
				description: 'Return only notifications sent through these channels',
				routing: { send: { type: 'query', property: 'channels' } },
			},
			{
				displayName: 'Created After',
				name: 'after',
				type: 'dateTime',
				default: '',
				description: 'Return only notifications created after this time',
				routing: { send: { type: 'query', property: 'after' } },
			},
			{
				displayName: 'Created Before',
				name: 'before',
				type: 'dateTime',
				default: '',
				description: 'Return only notifications created before this time',
				routing: { send: { type: 'query', property: 'before' } },
			},
			{
				displayName: 'Subscriber IDs',
				name: 'subscriberIds',
				type: 'string',
				default: '',
				placeholder: 'e.g. user-123, user-456',
				description: 'Comma-separated list of subscriber IDs',
				routing: { send: { type: 'query', property: 'subscriberIds', value: toListExpression } },
			},
			{
				displayName: 'Topic Key',
				name: 'topicKey',
				type: 'string',
				default: '',
				placeholder: 'e.g. product-updates',
				description: 'Return only notifications sent to this topic',
				routing: { send: { type: 'query', property: 'topicKey' } },
			},
			{
				displayName: 'Transaction ID',
				name: 'transactionId',
				type: 'string',
				default: '',
				placeholder: 'e.g. txn_6a6ca1d0enox20i3o14k',
				description: 'Return only notifications from this trigger',
				routing: { send: { type: 'query', property: 'transactionId' } },
			},
			{
				displayName: 'Workflow Names or IDs',
				name: 'templates',
				type: 'multiOptions',
				default: [],
				typeOptions: { loadOptionsMethod: 'getWorkflows' },
				description:
					'Return only notifications from these workflows. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: { send: { type: 'query', property: 'templates' } },
			},
		],
	},
	simplifyField({ resource: ['notification'], operation: ['get', 'getAll'] }),
];

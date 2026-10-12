import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type PostReceiveAction,
} from 'n8n-workflow';

/* -------------------------------------------------------------------------- */
/*                               Parameter helpers                            */
/* -------------------------------------------------------------------------- */

/** Read a JSON parameter that may arrive as a string or as an already-parsed object. */
export function parseJsonParameter(
	this: IExecuteSingleFunctions,
	parameterName: string,
	displayName: string,
	expected: 'object' | 'array' = 'object',
): IDataObject | IDataObject[] | undefined {
	const raw = this.getNodeParameter(parameterName, undefined) as unknown;
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}

	let value: unknown = raw;
	if (typeof raw === 'string') {
		if (raw.trim() === '') {
			return undefined;
		}
		try {
			value = JSON.parse(raw);
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				`The '${displayName}' parameter is not valid JSON`,
				{
					itemIndex: this.getItemIndex(),
					description: `Check the '${displayName}' value. It must be a JSON ${expected}, for example ${
						expected === 'array'
							? '[{"name": "welcome", "to": "user-123"}]'
							: '{"firstName": "Nathan"}'
					}.`,
				},
			);
		}
	}

	const isArray = Array.isArray(value);
	const isObject = typeof value === 'object' && value !== null && !isArray;
	if ((expected === 'array' && !isArray) || (expected === 'object' && !isObject)) {
		throw new NodeOperationError(
			this.getNode(),
			`The '${displayName}' parameter must be a JSON ${expected}`,
			{
				itemIndex: this.getItemIndex(),
				description: `Change the '${displayName}' value to a JSON ${expected}.`,
			},
		);
	}

	return value as IDataObject | IDataObject[];
}

/** Split a comma-separated list (or accept an array) into trimmed, non-empty strings. */
export function toStringList(value: unknown): string[] {
	const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
	return parts.map((part) => String(part).trim()).filter((part) => part.length > 0);
}

function getResourceLocatorValue(this: IExecuteSingleFunctions, parameterName: string): string {
	return String(
		this.getNodeParameter(parameterName, undefined, { extractValue: true }) ?? '',
	).trim();
}

function setBody(requestOptions: IHttpRequestOptions, body: IDataObject): IHttpRequestOptions {
	requestOptions.body = { ...((requestOptions.body as IDataObject) ?? {}), ...body };
	return requestOptions;
}

/* -------------------------------------------------------------------------- */
/*                                  Pre-send                                  */
/* -------------------------------------------------------------------------- */

const SUBSCRIBER_DETAIL_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'locale', 'timezone'];

function buildCommonEventFields(this: IExecuteSingleFunctions): IDataObject {
	const options = this.getNodeParameter('eventOptions', {}) as IDataObject;
	const body: IDataObject = {
		name: getResourceLocatorValue.call(this, 'workflowId'),
		payload: parseJsonParameter.call(this, 'payload', 'Payload') ?? {},
	};

	if (options.transactionId) {
		body.transactionId = options.transactionId;
	}
	if (options.actorSubscriberId) {
		body.actor = options.actorSubscriberId;
	}
	if (options.tenantIdentifier) {
		body.tenant = options.tenantIdentifier;
	}
	if (options.overrides) {
		const overrides = parseJsonParameter.call(this, 'eventOptions.overrides', 'Overrides');
		if (overrides && Object.keys(overrides).length > 0) {
			body.overrides = overrides;
		}
	}
	return body;
}

export async function buildTriggerEventBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body = buildCommonEventFields.call(this);
	const recipientType = this.getNodeParameter('recipientType', 'subscriber') as string;

	if (recipientType === 'topic') {
		body.to = { type: 'Topic', topicKey: getResourceLocatorValue.call(this, 'topicKey') };
	} else {
		const subscriberId = String(this.getNodeParameter('subscriberId', '')).trim();
		const details = this.getNodeParameter('subscriberDetails', {}) as IDataObject;
		const recipient: IDataObject = { subscriberId };
		for (const field of SUBSCRIBER_DETAIL_FIELDS) {
			if (details[field] !== undefined && details[field] !== '') {
				recipient[field] = details[field];
			}
		}
		body.to = Object.keys(recipient).length > 1 ? recipient : subscriberId;
	}

	return setBody(requestOptions, body);
}

export async function buildBroadcastEventBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	return setBody(requestOptions, buildCommonEventFields.call(this));
}

export async function buildBulkEventBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const events = parseJsonParameter.call(this, 'events', 'Events', 'array') as IDataObject[];
	if (!events || events.length === 0) {
		throw new NodeOperationError(this.getNode(), "The 'Events' parameter is empty", {
			itemIndex: this.getItemIndex(),
			description:
				'Add at least one event, each with a "name" (workflow trigger identifier) and a "to".',
		});
	}
	if (events.length > 100) {
		throw new NodeOperationError(
			this.getNode(),
			"The 'Events' parameter has more than 100 events",
			{
				itemIndex: this.getItemIndex(),
				description:
					'Notifly accepts up to 100 events per bulk request. Split them across several items.',
			},
		);
	}
	return setBody(requestOptions, { events });
}

export async function buildSubscriberIdField(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const subscriberId = String(this.getNodeParameter('subscriberId', '')).trim();
	return setBody(requestOptions, { subscriberId });
}

/** Parses the optional 'Custom Data' JSON field of a create or update collection into the body. */
export async function buildCustomDataField(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const fieldsParameter =
		this.getNodeParameter('operation') === 'create' ? 'additionalFields' : 'updateFields';
	const fields = this.getNodeParameter(fieldsParameter, {}) as IDataObject;
	if (fields.data === undefined) {
		return requestOptions;
	}
	const data = parseJsonParameter.call(this, `${fieldsParameter}.data`, 'Custom Data');
	return setBody(requestOptions, { data: data ?? {} });
}

export async function buildTopicSubscriptionsBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const subscriberIds = toStringList(this.getNodeParameter('subscriberIds', ''));
	if (subscriberIds.length === 0) {
		throw new NodeOperationError(this.getNode(), "The 'Subscriber IDs' parameter is empty", {
			itemIndex: this.getItemIndex(),
			description: 'Enter one or more subscriber IDs, separated by commas.',
		});
	}
	return setBody(requestOptions, { subscriberIds });
}

export async function buildPreferencesBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const channels = this.getNodeParameter('channels', {}) as IDataObject;
	const scope = this.getNodeParameter('preferenceScope', 'global') as string;
	const body: IDataObject = { channels };

	if (Object.keys(channels).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No channel preference was set', {
			itemIndex: this.getItemIndex(),
			description: "Add at least one channel under 'Channels' and choose whether it's enabled.",
		});
	}
	if (scope === 'workflow') {
		body.workflowId = getResourceLocatorValue.call(this, 'workflowId');
	}
	return setBody(requestOptions, body);
}

/* -------------------------------------------------------------------------- */
/*                                Post-receive                                */
/* -------------------------------------------------------------------------- */

export async function returnDeleted(this: IExecuteSingleFunctions): Promise<INodeExecutionData[]> {
	return [{ json: { deleted: true } }];
}

export async function returnCancelled(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject | boolean;
	const cancelled = typeof body === 'boolean' ? body : Boolean((body as IDataObject)?.data);
	return [
		{
			json: {
				cancelled,
				transactionId: this.getNodeParameter('transactionId') as string,
			},
		},
	];
}

type Simplifier = (item: IDataObject) => IDataObject;

function pick(source: IDataObject, keys: string[]): IDataObject {
	const result: IDataObject = {};
	for (const key of keys) {
		if (source[key] !== undefined) {
			result[key] = source[key];
		}
	}
	return result;
}

export const simplifySubscriber: Simplifier = (subscriber) =>
	pick(subscriber, [
		'subscriberId',
		'email',
		'firstName',
		'lastName',
		'phone',
		'locale',
		'timezone',
		'data',
		'createdAt',
		'updatedAt',
	]);

export const simplifyWorkflow: Simplifier = (workflow) => ({
	...pick(workflow, ['workflowId', 'name', 'status', 'active', 'tags']),
	id: workflow._id,
	...pick(workflow, ['origin', 'createdAt', 'updatedAt', 'lastTriggeredAt']),
});

export const simplifyNotification: Simplifier = (notification) => {
	const subscriber = (notification.subscriber as IDataObject) ?? {};
	const template = (notification.template as IDataObject) ?? {};
	const triggers = (template.triggers as IDataObject[]) ?? [];
	const jobs = (notification.jobs as IDataObject[]) ?? [];
	return {
		id: notification._id,
		transactionId: notification.transactionId,
		createdAt: notification.createdAt,
		workflowName: template.name,
		workflowId: triggers[0]?.identifier,
		subscriberId: subscriber.subscriberId,
		subscriberEmail: subscriber.email,
		channels: notification.channels,
		steps: jobs.map((job) => ({ type: job.type, status: job.status })),
		payload: notification.payload,
	};
};

/** Post-receive action that applies a simplifier when the node's 'Simplify' toggle is on. */
export function simplifyOutput(simplifier: Simplifier): PostReceiveAction {
	return async function (
		this: IExecuteSingleFunctions,
		items: INodeExecutionData[],
	): Promise<INodeExecutionData[]> {
		const simplify = this.getNodeParameter('simplify', true) as boolean;
		if (!simplify) {
			return items;
		}
		return items.map((item) => ({ ...item, json: simplifier(item.json) }));
	};
}

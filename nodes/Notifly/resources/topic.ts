import type { INodeProperties } from 'n8n-workflow';
import { cursorPagination, returnAllAndLimit, topicLocator } from '../shared/descriptions';
import { buildCustomDataField, buildTopicSubscriptionsBody, returnDeleted } from '../shared/utils';

const showForTopic = { resource: ['topic'] };
const topicUrl = '=/v2/topics/{{ encodeURIComponent($parameter.topicKey) }}';
const unwrapData = { type: 'rootProperty' as const, properties: { property: 'data' } };

const customDataField: INodeProperties = {
	displayName: 'Custom Data',
	name: 'data',
	type: 'json',
	default: '{}',
	description: 'Custom data to store on the topic, for example {"team": "growth"}',
};

const nameField = (description: string): INodeProperties => ({
	displayName: 'Name',
	name: 'name',
	type: 'string',
	default: '',
	placeholder: 'e.g. Product Updates',
	description,
	routing: { send: { type: 'body', property: 'name' } },
});

export const topicDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForTopic },
		options: [
			{
				name: 'Add Subscribers',
				value: 'addSubscribers',
				action: 'Add subscribers to topic',
				description: 'Subscribe one or more subscribers to a topic',
				routing: {
					request: { method: 'POST', url: `${topicUrl}/subscriptions` },
					send: { preSend: [buildTopicSubscriptionsBody] },
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create topic',
				description: 'Create a new topic',
				routing: {
					request: { method: 'POST', url: '/v2/topics' },
					send: { preSend: [buildCustomDataField] },
					output: { postReceive: [unwrapData] },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete topic',
				description: 'Delete a topic permanently',
				routing: {
					request: { method: 'DELETE', url: topicUrl },
					output: { postReceive: [returnDeleted] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get topic',
				description: 'Retrieve a topic',
				routing: {
					request: { method: 'GET', url: topicUrl },
					output: { postReceive: [unwrapData] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many topics',
				description: 'Retrieve a list of topics',
				routing: {
					request: { method: 'GET', url: '/v2/topics' },
					output: { postReceive: [unwrapData] },
				},
			},
			{
				name: 'Remove Subscribers',
				value: 'removeSubscribers',
				action: 'Remove subscribers from topic',
				description: 'Unsubscribe one or more subscribers from a topic',
				routing: {
					request: { method: 'DELETE', url: `${topicUrl}/subscriptions` },
					send: { preSend: [buildTopicSubscriptionsBody] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update topic',
				description: "Update a topic's name or custom data",
				routing: {
					request: { method: 'PATCH', url: topicUrl },
					send: { preSend: [buildCustomDataField] },
					output: { postReceive: [unwrapData] },
				},
			},
		],
		default: 'create',
	},

	/* --------------------------------- Create -------------------------------- */
	{
		displayName: 'Topic Key',
		name: 'key',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. product-updates',
		description:
			'A unique key for the topic. You use it to trigger events to every subscriber in the topic.',
		displayOptions: { show: { resource: ['topic'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'key' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['topic'], operation: ['create'] } },
		options: [customDataField, nameField('A display name for the topic')],
	},

	/* ------------------------ Topic-scoped operations ------------------------ */
	topicLocator({
		resource: ['topic'],
		operation: ['addSubscribers', 'delete', 'get', 'removeSubscribers', 'update'],
	}),

	/* --------------------------------- Update -------------------------------- */
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['topic'], operation: ['update'] } },
		options: [customDataField, nameField('The new display name for the topic')],
	},

	/* ------------------------- Add / Remove Subscribers ----------------------- */
	{
		displayName: 'Subscriber IDs',
		name: 'subscriberIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. user-123, user-456',
		description: 'Comma-separated list of subscriber IDs (up to 100)',
		displayOptions: {
			show: { resource: ['topic'], operation: ['addSubscribers', 'removeSubscribers'] },
		},
	},

	/* -------------------------------- Get Many ------------------------------- */
	...returnAllAndLimit({ resource: ['topic'], operation: ['getAll'] }, 100, cursorPagination(100)),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['topic'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				placeholder: 'e.g. Product Updates',
				description: 'Return only topics whose name contains this text',
				routing: { send: { type: 'query', property: 'name' } },
			},
			{
				displayName: 'Topic Key',
				name: 'key',
				type: 'string',
				default: '',
				placeholder: 'e.g. product-updates',
				description: 'Return only the topic with this key',
				routing: { send: { type: 'query', property: 'key' } },
			},
		],
	},
];

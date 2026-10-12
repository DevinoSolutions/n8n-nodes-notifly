import type { INodeProperties } from 'n8n-workflow';
import {
	cursorPagination,
	returnAllAndLimit,
	simplifyField,
	subscriberIdField,
	workflowLocator,
} from '../shared/descriptions';
import {
	buildCustomDataField,
	buildPreferencesBody,
	buildSubscriberIdField,
	returnDeleted,
	simplifyOutput,
	simplifySubscriber,
} from '../shared/utils';

const showForSubscriber = { resource: ['subscriber'] };
const subscriberUrl = '=/v2/subscribers/{{ encodeURIComponent($parameter.subscriberId) }}';
const unwrapData = { type: 'rootProperty' as const, properties: { property: 'data' } };

const profileFields = (forUpdate: boolean): INodeProperties[] => [
	{
		displayName: 'Avatar URL',
		name: 'avatar',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/image.png',
		routing: { send: { type: 'body', property: 'avatar' } },
	},
	{
		displayName: 'Custom Data',
		name: 'data',
		type: 'json',
		default: '{}',
		description: forUpdate
			? 'Custom data to store on the subscriber. It replaces the existing custom data.'
			: 'Custom data to store on the subscriber, for example {"plan": "pro"}',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		default: '',
		placeholder: 'e.g. nathan@example.com',
		routing: { send: { type: 'body', property: 'email' } },
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		default: '',
		placeholder: 'e.g. Nathan',
		routing: { send: { type: 'body', property: 'firstName' } },
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		default: '',
		placeholder: 'e.g. Smith',
		routing: { send: { type: 'body', property: 'lastName' } },
	},
	{
		displayName: 'Locale',
		name: 'locale',
		type: 'string',
		default: '',
		placeholder: 'e.g. en-US',
		routing: { send: { type: 'body', property: 'locale' } },
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		placeholder: 'e.g. +15551234567',
		routing: { send: { type: 'body', property: 'phone' } },
	},
	{
		displayName: 'Timezone',
		name: 'timezone',
		type: 'string',
		default: '',
		placeholder: 'e.g. America/New_York',
		routing: { send: { type: 'body', property: 'timezone' } },
	},
];

const channelToggle = (displayName: string, name: string): INodeProperties => ({
	displayName,
	name,
	type: 'boolean',
	default: true,
	description: `Whether the subscriber receives ${displayName.toLowerCase()} notifications`,
});

export const subscriberDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForSubscriber },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create subscriber',
				description: 'Create a new subscriber',
				routing: {
					request: { method: 'POST', url: '/v2/subscribers' },
					send: { preSend: [buildSubscriberIdField, buildCustomDataField] },
					output: { postReceive: [unwrapData] },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete subscriber',
				description: 'Delete a subscriber permanently',
				routing: {
					request: { method: 'DELETE', url: subscriberUrl },
					output: { postReceive: [returnDeleted] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get subscriber',
				description: 'Retrieve a subscriber',
				routing: {
					request: { method: 'GET', url: subscriberUrl },
					output: { postReceive: [unwrapData, simplifyOutput(simplifySubscriber)] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many subscribers',
				description: 'Retrieve or search a list of subscribers',
				routing: {
					request: { method: 'GET', url: '/v2/subscribers' },
					output: { postReceive: [unwrapData, simplifyOutput(simplifySubscriber)] },
				},
			},
			{
				name: 'Get Preferences',
				value: 'getPreferences',
				action: 'Get subscriber preferences',
				description: "Retrieve a subscriber's global and per-workflow channel preferences",
				routing: {
					request: { method: 'GET', url: `${subscriberUrl}/preferences` },
					output: { postReceive: [unwrapData] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update subscriber',
				description: "Update a subscriber's profile",
				routing: {
					request: { method: 'PATCH', url: subscriberUrl },
					send: { preSend: [buildCustomDataField] },
					output: { postReceive: [unwrapData] },
				},
			},
			{
				name: 'Update Preferences',
				value: 'updatePreferences',
				action: 'Update subscriber preferences',
				description:
					'Turn notification channels on or off for a subscriber, globally or for one workflow',
				routing: {
					request: { method: 'PATCH', url: `${subscriberUrl}/preferences` },
					send: { preSend: [buildPreferencesBody] },
					output: { postReceive: [unwrapData] },
				},
			},
		],
		default: 'create',
	},

	subscriberIdField({
		resource: ['subscriber'],
		operation: ['create', 'delete', 'get', 'getPreferences', 'update', 'updatePreferences'],
	}),

	/* --------------------------------- Create -------------------------------- */
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['subscriber'], operation: ['create'] } },
		options: [
			...profileFields(false).slice(0, 3),
			{
				displayName: 'Fail If Exists',
				name: 'failIfExists',
				type: 'boolean',
				default: false,
				description:
					'Whether to fail when a subscriber with this ID already exists, instead of returning the existing one',
				routing: { send: { type: 'query', property: 'failIfExists' } },
			},
			...profileFields(false).slice(3),
		],
	},

	/* --------------------------------- Update -------------------------------- */
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['subscriber'], operation: ['update'] } },
		options: profileFields(true),
	},

	/* -------------------------------- Get Many ------------------------------- */
	...returnAllAndLimit(
		{ resource: ['subscriber'], operation: ['getAll'] },
		100,
		cursorPagination(100),
	),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['subscriber'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				placeholder: 'e.g. nathan@example.com',
				routing: { send: { type: 'query', property: 'email' } },
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				placeholder: 'e.g. Nathan Smith',
				routing: { send: { type: 'query', property: 'name' } },
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				placeholder: 'e.g. +15551234567',
				routing: { send: { type: 'query', property: 'phone' } },
			},
			{
				displayName: 'Subscriber ID',
				name: 'subscriberId',
				type: 'string',
				default: '',
				placeholder: 'e.g. user-123',
				routing: { send: { type: 'query', property: 'subscriberId' } },
			},
		],
	},
	simplifyField({ resource: ['subscriber'], operation: ['get', 'getAll'] }),

	/* ---------------------------- Get Preferences ---------------------------- */
	{
		displayName: 'Options',
		name: 'preferenceOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['subscriber'], operation: ['getPreferences'] } },
		options: [
			{
				displayName: 'Criticality',
				name: 'criticality',
				type: 'options',
				default: 'nonCritical',
				description: 'Which workflows to include, based on whether they are marked as critical',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Critical', value: 'critical' },
					{ name: 'Non-Critical', value: 'nonCritical' },
				],
				routing: { send: { type: 'query', property: 'criticality' } },
			},
		],
	},

	/* -------------------------- Update Preferences --------------------------- */
	{
		displayName: 'Apply To',
		name: 'preferenceScope',
		type: 'options',
		default: 'global',
		displayOptions: { show: { resource: ['subscriber'], operation: ['updatePreferences'] } },
		options: [
			{
				name: 'All Workflows',
				value: 'global',
				description: "Update the subscriber's global preferences",
			},
			{
				name: 'One Workflow',
				value: 'workflow',
				description: "Update the subscriber's preferences for a single workflow",
			},
		],
	},
	workflowLocator(
		{ resource: ['subscriber'], operation: ['updatePreferences'], preferenceScope: ['workflow'] },
		'The workflow to update preferences for',
	),
	{
		displayName: 'Channels',
		name: 'channels',
		type: 'collection',
		placeholder: 'Add Channel',
		default: {},
		required: true,
		displayOptions: { show: { resource: ['subscriber'], operation: ['updatePreferences'] } },
		options: [
			channelToggle('Chat', 'chat'),
			channelToggle('Email', 'email'),
			channelToggle('In-App', 'in_app'),
			channelToggle('Push', 'push'),
			channelToggle('SMS', 'sms'),
		],
	},
];

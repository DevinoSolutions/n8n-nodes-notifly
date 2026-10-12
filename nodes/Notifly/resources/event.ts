import type { INodeProperties } from 'n8n-workflow';
import { topicLocator, workflowLocator } from '../shared/descriptions';
import {
	buildBroadcastEventBody,
	buildBulkEventBody,
	buildTriggerEventBody,
	returnCancelled,
} from '../shared/utils';

const showForEvent = { resource: ['event'] };
const showForTrigger = { resource: ['event'], operation: ['trigger'] };
const showForTriggerOrBroadcast = { resource: ['event'], operation: ['trigger', 'broadcast'] };

export const eventDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForEvent },
		options: [
			{
				name: 'Broadcast',
				value: 'broadcast',
				action: 'Broadcast event to all subscribers',
				description: 'Trigger a workflow for every subscriber in the environment',
				routing: {
					request: { method: 'POST', url: '/v1/events/trigger/broadcast' },
					send: { preSend: [buildBroadcastEventBody] },
					output: {
						postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }],
					},
				},
			},
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel event',
				description:
					'Cancel a triggered event that is still pending, such as a delayed or digested one',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/v1/events/trigger/{{ encodeURIComponent($parameter.transactionId) }}',
					},
					output: { postReceive: [returnCancelled] },
				},
			},
			{
				name: 'Trigger',
				value: 'trigger',
				action: 'Trigger event',
				description: 'Trigger a workflow to send a notification to a subscriber or topic',
				routing: {
					request: { method: 'POST', url: '/v1/events/trigger' },
					send: { preSend: [buildTriggerEventBody] },
					output: {
						postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }],
					},
				},
			},
			{
				name: 'Trigger Many',
				value: 'triggerBulk',
				action: 'Trigger many events',
				description: 'Trigger up to 100 events in a single request',
				routing: {
					request: { method: 'POST', url: '/v1/events/trigger/bulk' },
					send: { preSend: [buildBulkEventBody] },
					output: {
						postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }],
					},
				},
			},
		],
		default: 'trigger',
	},

	/* --------------------------- Trigger & Broadcast -------------------------- */
	workflowLocator(showForTriggerOrBroadcast, 'The Notifly workflow to trigger'),
	{
		displayName: 'Send To',
		name: 'recipientType',
		type: 'options',
		default: 'subscriber',
		displayOptions: { show: showForTrigger },
		options: [
			{
				name: 'Subscriber',
				value: 'subscriber',
				description:
					'Send to one subscriber. Notifly creates the subscriber if it does not exist yet.',
			},
			{
				name: 'Topic',
				value: 'topic',
				description: 'Send to every subscriber of a topic',
			},
		],
	},
	{
		displayName: 'Subscriber ID',
		name: 'subscriberId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. user-123',
		description: 'The ID you use for this subscriber in your own app',
		displayOptions: { show: { ...showForTrigger, recipientType: ['subscriber'] } },
	},
	topicLocator({ ...showForTrigger, recipientType: ['topic'] }),
	{
		displayName: 'Payload',
		name: 'payload',
		type: 'json',
		default: '{}',
		description:
			'Data the workflow uses in its templates, for example {"orderId": "1234"}. It must match the workflow payload schema if one is set.',
		displayOptions: { show: showForTriggerOrBroadcast },
	},
	{
		displayName: 'Subscriber Details',
		name: 'subscriberDetails',
		type: 'collection',
		placeholder: 'Add Detail',
		default: {},
		description: 'Details to create or update on the subscriber while triggering',
		displayOptions: { show: { ...showForTrigger, recipientType: ['subscriber'] } },
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'e.g. nathan@example.com',
				default: '',
			},
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				placeholder: 'e.g. Nathan',
				default: '',
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				placeholder: 'e.g. Smith',
				default: '',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				placeholder: 'e.g. en-US',
				default: '',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				placeholder: 'e.g. +15551234567',
				default: '',
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				placeholder: 'e.g. America/New_York',
				default: '',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'eventOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showForTriggerOrBroadcast },
		options: [
			{
				displayName: 'Actor Subscriber ID',
				name: 'actorSubscriberId',
				type: 'string',
				default: '',
				placeholder: 'e.g. user-456',
				description: 'The subscriber who performed the action, available as "actor" in templates',
			},
			{
				displayName: 'Overrides',
				name: 'overrides',
				type: 'json',
				default: '{}',
				description:
					'Per-channel or per-provider overrides, for example {"email": {"from": "team@example.com"}}',
			},
			{
				displayName: 'Tenant Identifier',
				name: 'tenantIdentifier',
				type: 'string',
				default: '',
				placeholder: 'e.g. acme-inc',
				description: 'The tenant to trigger the workflow for',
			},
			{
				displayName: 'Transaction ID',
				name: 'transactionId',
				type: 'string',
				default: '',
				placeholder: 'e.g. order-1234-shipped',
				description:
					'A unique ID for this trigger. Use it to cancel the event later or to avoid sending twice.',
			},
		],
	},

	/* ------------------------------ Trigger Many ------------------------------ */
	{
		displayName: 'Events',
		name: 'events',
		type: 'json',
		required: true,
		default: '[\n  {\n    "name": "welcome",\n    "to": "user-123",\n    "payload": {}\n  }\n]',
		description:
			'A JSON array of up to 100 events. Each needs "name" (the workflow identifier) and "to" (a subscriber ID, subscriber object or topic).',
		displayOptions: { show: { resource: ['event'], operation: ['triggerBulk'] } },
	},

	/* --------------------------------- Cancel -------------------------------- */
	{
		displayName: 'Transaction ID',
		name: 'transactionId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. txn_6a6ca1d0enox20i3o14k',
		description: 'The transaction ID returned when the event was triggered',
		displayOptions: { show: { resource: ['event'], operation: ['cancel'] } },
	},
];

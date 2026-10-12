import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { getWorkflows, searchTopics, searchWorkflows } from './listSearch';
import { eventDescription } from './resources/event';
import { notificationDescription } from './resources/notification';
import { subscriberDescription } from './resources/subscriber';
import { topicDescription } from './resources/topic';
import { workflowDescription } from './resources/workflow';

export class Notifly implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Notifly',
		name: 'notifly',
		icon: { light: 'file:../../icons/notifly.svg', dark: 'file:../../icons/notifly.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Send notifications across email, SMS, push, chat and in-app, and manage subscribers and topics in Notifly',
		defaults: {
			name: 'Notifly',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'notiflyApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{ ($credentials.baseUrl || "https://api.notifly.io").replace(/\\/+$/, "") }}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Event',
						value: 'event',
						description: 'Trigger workflows to send notifications',
					},
					{
						name: 'Notification',
						value: 'notification',
						description: 'Read notification activity and delivery status',
					},
					{
						name: 'Subscriber',
						value: 'subscriber',
						description: 'People who receive notifications',
					},
					{
						name: 'Topic',
						value: 'topic',
						description: 'Groups of subscribers you can notify at once',
					},
					{
						name: 'Workflow',
						value: 'workflow',
						description: 'Notification workflows defined in Notifly',
					},
				],
				default: 'event',
			},
			...eventDescription,
			...notificationDescription,
			...subscriberDescription,
			...topicDescription,
			...workflowDescription,
		],
	};

	methods = {
		listSearch: {
			searchTopics,
			searchWorkflows,
		},
		loadOptions: {
			getWorkflows,
		},
	};
}

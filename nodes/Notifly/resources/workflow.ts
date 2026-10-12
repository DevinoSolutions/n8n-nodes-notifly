import type { INodeProperties } from 'n8n-workflow';
import {
	offsetPagination,
	returnAllAndLimit,
	simplifyField,
	workflowLocator,
} from '../shared/descriptions';
import { simplifyOutput, simplifyWorkflow } from '../shared/utils';

const showForWorkflow = { resource: ['workflow'] };
const PAGE_SIZE = 100;

export const workflowDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForWorkflow },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get workflow',
				description: 'Retrieve a workflow with its steps and payload schema',
				routing: {
					request: {
						method: 'GET',
						url: '=/v2/workflows/{{ encodeURIComponent($parameter.workflowId) }}',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'data' } },
							simplifyOutput(simplifyWorkflow),
						],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many workflows',
				description: 'Retrieve a list of workflows',
				routing: {
					request: { method: 'GET', url: '/v2/workflows' },
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'data.workflows' } },
							simplifyOutput(simplifyWorkflow),
						],
					},
				},
			},
		],
		default: 'getAll',
	},

	workflowLocator({ resource: ['workflow'], operation: ['get'] }, 'The workflow to retrieve'),

	...returnAllAndLimit(
		{ resource: ['workflow'], operation: ['getAll'] },
		PAGE_SIZE,
		offsetPagination(PAGE_SIZE),
	),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['workflow'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Search',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'e.g. welcome',
				description: 'Return only workflows whose name or identifier matches this text',
				routing: { send: { type: 'query', property: 'query' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Active', value: 'ACTIVE' },
					{ name: 'Error', value: 'ERROR' },
					{ name: 'Inactive', value: 'INACTIVE' },
				],
				routing: { send: { type: 'query', property: 'status' } },
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				placeholder: 'e.g. onboarding, billing',
				description: 'Comma-separated list of tags. Returns workflows that have any of them.',
				routing: {
					send: {
						type: 'query',
						property: 'tags',
						value:
							'={{ $value.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0) }}',
					},
				},
			},
		],
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'collection',
		placeholder: 'Add Sort Rule',
		default: {},
		displayOptions: { show: { resource: ['workflow'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Direction',
				name: 'orderDirection',
				type: 'options',
				default: 'DESC',
				options: [
					{ name: 'Ascending', value: 'ASC' },
					{ name: 'Descending', value: 'DESC' },
				],
				routing: { send: { type: 'query', property: 'orderDirection' } },
			},
			{
				displayName: 'Sort By',
				name: 'orderBy',
				type: 'options',
				default: 'createdAt',
				options: [
					{ name: 'Created At', value: 'createdAt' },
					{ name: 'Last Triggered At', value: 'lastTriggeredAt' },
					{ name: 'Name', value: 'name' },
					{ name: 'Updated At', value: 'updatedAt' },
				],
				routing: { send: { type: 'query', property: 'orderBy' } },
			},
		],
	},
	simplifyField({ resource: ['workflow'], operation: ['get', 'getAll'] }),
];

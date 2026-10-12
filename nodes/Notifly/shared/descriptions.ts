import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	INodeExecutionData,
	INodeProperties,
	INodePropertyRouting,
} from 'n8n-workflow';

type DisplayShow = NonNullable<NonNullable<INodeProperties['displayOptions']>['show']>;

export const workflowLocator = (
	show: DisplayShow,
	description = 'The Notifly workflow to use',
): INodeProperties => ({
	displayName: 'Workflow',
	name: 'workflowId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description,
	displayOptions: { show },
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a workflow...',
			typeOptions: {
				searchListMethod: 'searchWorkflows',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. welcome-email',
			hint: 'The workflow identifier shown in the Notifly dashboard',
		},
	],
});

export const topicLocator = (show: DisplayShow): INodeProperties => ({
	displayName: 'Topic',
	name: 'topicKey',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Notifly topic to use',
	displayOptions: { show },
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a topic...',
			typeOptions: {
				searchListMethod: 'searchTopics',
				searchable: true,
			},
		},
		{
			displayName: 'By Key',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. product-updates',
		},
	],
});

export const subscriberIdField = (show: DisplayShow): INodeProperties => ({
	displayName: 'Subscriber ID',
	name: 'subscriberId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. user-123',
	description: 'The ID you use for this subscriber in your own app',
	displayOptions: { show },
});

export const simplifyField = (show: DisplayShow): INodeProperties => ({
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description: 'Whether to return a simplified version of the response instead of the raw data',
	displayOptions: { show },
});

/**
 * Return All + Limit pair for list endpoints.
 * `paginationRouting` describes how to fetch the next page when Return All is on.
 */
export const returnAllAndLimit = (
	show: DisplayShow,
	maxLimit: number,
	paginationRouting: INodePropertyRouting,
): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show },
		routing: paginationRouting,
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: maxLimit },
		description: 'Max number of results to return',
		displayOptions: { show: { ...show, returnAll: [false] } },
		routing: {
			send: { type: 'query', property: 'limit' },
			output: { maxResults: '={{$value}}' },
		},
	},
];

/*
 * Note on n8n's generic pagination: the `request` expression is evaluated before every
 * request (with an empty `$response` on the first one), `$request` always holds the
 * original options, and the result is shallow-merged, so `qs` must be rebuilt in full.
 */

/** An expression that n8n resolves to the full query-string object at request time. */
const qsExpression = (expression: string): IDataObject => expression as unknown as IDataObject;

/** Pagination for v2 list endpoints that return `{ data: [...], next }` cursors. */
export const cursorPagination = (pageSize: number): INodePropertyRouting => ({
	send: {
		paginate: '={{ $value }}',
		type: 'query',
		property: 'limit',
		value: String(pageSize),
	},
	operations: {
		pagination: {
			type: 'generic',
			properties: {
				continue: '={{ !!$response.body?.next }}',
				request: {
					qs: qsExpression(
						'={{ Object.assign({}, $request.qs, $response.body?.next ? { after: $response.body.next } : {}) }}',
					),
				},
			},
		},
	},
});

/** Pagination for v1 list endpoints that return `{ data: [...], page, hasMore }`. */
export const pagePagination = (pageSize: number): INodePropertyRouting => ({
	send: {
		paginate: '={{ $value }}',
		type: 'query',
		property: 'limit',
		value: String(pageSize),
	},
	operations: {
		pagination: {
			type: 'generic',
			properties: {
				continue: '={{ !!$response.body?.hasMore }}',
				request: {
					qs: qsExpression(
						'={{ Object.assign({}, $request.qs, { page: $response.body?.hasMore ? Number($response.body.page) + 1 : 0 }) }}',
					),
				},
			},
		},
	},
});

/** Pagination for endpoints that take `limit` + `offset`, stopping at the first short page. */
export const offsetPagination = (pageSize: number): INodePropertyRouting => ({
	send: {
		paginate: '={{ $value }}',
	},
	operations: {
		pagination: async function (
			this: IExecutePaginationFunctions,
			requestData: DeclarativeRestApiSettings.ResultOptions,
		): Promise<INodeExecutionData[]> {
			const results: INodeExecutionData[] = [];
			// Hard stop at 100 pages so a misbehaving API can never loop forever.
			for (let page = 0; page < 100; page++) {
				const items = await this.makeRoutingRequest({
					...requestData,
					options: {
						...requestData.options,
						qs: { ...(requestData.options.qs ?? {}), limit: pageSize, offset: page * pageSize },
					},
				});
				results.push(...items);
				if (items.length < pageSize) break;
			}
			return results;
		},
	},
});

import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { notiflyApiRequest } from '../shared/transport';

type WorkflowListItem = {
	_id: string;
	name: string;
	workflowId: string;
	slug?: string;
	status?: string;
};

type WorkflowListResponse = {
	data?: {
		workflows?: WorkflowListItem[];
		totalCount?: number;
	};
};

type TopicListItem = {
	_id: string;
	key: string;
	name?: string;
};

type TopicListResponse = {
	data?: TopicListItem[];
	next?: string | null;
};

const WORKFLOW_PAGE_SIZE = 100;

async function listWorkflows(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<{ workflows: WorkflowListItem[]; nextToken?: string }> {
	const offset = paginationToken ? Number(paginationToken) : 0;
	const qs: IDataObject = {
		limit: WORKFLOW_PAGE_SIZE,
		offset,
		orderBy: 'name',
		orderDirection: 'ASC',
	};
	if (filter) {
		qs.query = filter;
	}

	const response = (await notiflyApiRequest.call(
		this,
		'GET',
		'/v2/workflows',
		qs,
	)) as WorkflowListResponse;

	const workflows = response.data?.workflows ?? [];
	const totalCount = response.data?.totalCount ?? 0;
	const nextOffset = offset + workflows.length;
	return {
		workflows,
		nextToken: workflows.length > 0 && nextOffset < totalCount ? String(nextOffset) : undefined,
	};
}

/** Workflows keyed by their trigger identifier (used to trigger events). */
export async function searchWorkflows(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const { workflows, nextToken } = await listWorkflows.call(this, filter, paginationToken);
	const results: INodeListSearchItems[] = workflows.map((workflow) => ({
		name: workflow.name,
		value: workflow.workflowId,
		description: workflow.workflowId,
	}));
	return { results, paginationToken: nextToken };
}

/** Dropdown options for workflow filters, keyed by internal ID (loadOptions). */
export async function getWorkflows(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const options: INodePropertyOptions[] = [];
	let token: string | undefined;
	// Cap at 10 pages (1,000 workflows) to keep the dropdown responsive.
	for (let page = 0; page < 10; page++) {
		const { workflows, nextToken } = await listWorkflows.call(this, undefined, token);
		for (const workflow of workflows) {
			options.push({ name: workflow.name, value: workflow._id, description: workflow.workflowId });
		}
		if (!nextToken) break;
		token = nextToken;
	}
	return options;
}

export async function searchTopics(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const qs: IDataObject = { limit: 100 };
	if (paginationToken) {
		qs.after = paginationToken;
	}
	if (filter) {
		qs.name = filter;
	}

	const response = (await notiflyApiRequest.call(
		this,
		'GET',
		'/v2/topics',
		qs,
	)) as TopicListResponse;

	const results: INodeListSearchItems[] = (response.data ?? []).map((topic) => ({
		name: topic.name ? `${topic.name} (${topic.key})` : topic.key,
		value: topic.key,
	}));
	return { results, paginationToken: response.next ?? undefined };
}

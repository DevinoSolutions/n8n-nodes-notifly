import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';

export const DEFAULT_BASE_URL = 'https://api.notifly.io';

type NotiflyContext =
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| ILoadOptionsFunctions
	| IPollFunctions;

export async function getBaseUrl(this: NotiflyContext): Promise<string> {
	const credentials = await this.getCredentials<{ baseUrl?: string }>('notiflyApi');
	const baseUrl = (credentials.baseUrl || DEFAULT_BASE_URL).trim();
	return baseUrl.replace(/\/+$/, '');
}

export async function notiflyApiRequest(
	this: NotiflyContext,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
	body: IDataObject | undefined = undefined,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		qs,
		body,
		url: `${await getBaseUrl.call(this)}${endpoint}`,
		json: true,
	};

	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'notiflyApi',
		options,
	)) as IDataObject;
}

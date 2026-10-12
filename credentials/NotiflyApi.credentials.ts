import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NotiflyApi implements ICredentialType {
	name = 'notiflyApi';

	displayName = 'Notifly API';

	icon: Icon = { light: 'file:../icons/notifly.svg', dark: 'file:../icons/notifly.dark.svg' };

	documentationUrl =
		'https://github.com/DevinoSolutions/n8n-nodes-notifly?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The secret key of your Notifly environment. In the Notifly dashboard, pick the environment and open API Keys in the sidebar.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.notifly.io',
			placeholder: 'e.g. https://api.notifly.io',
			description: 'The URL of the Notifly API. Change it only if you use a self-hosted Notifly.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=ApiKey {{$credentials.secretKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/v2/workflows',
			method: 'GET',
			qs: {
				limit: 1,
			},
		},
	};
}

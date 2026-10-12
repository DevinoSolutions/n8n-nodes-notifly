# n8n-nodes-notifly

This is an n8n community node for [Notifly](https://notifly.io), the notification infrastructure by Devino Solutions. It lets you send notifications across email, SMS, push, chat and in-app from your n8n workflows, manage subscribers and topics, and start workflows when Notifly creates a new notification.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Trigger](#trigger)
- [Usage example](#usage-example)
- [Use as an AI Agent tool](#use-as-an-ai-agent-tool)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

1. In n8n, go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-notifly` as the npm package name.
4. Accept the risks of using community nodes and select **Install**.

After installation, search for **Notifly** in the nodes panel. The package adds two nodes:

- **Notifly**: actions on events, subscribers, topics, workflows and notifications.
- **Notifly Trigger**: starts a workflow when a new notification is created.

## Credentials

The nodes authenticate with the secret key of a Notifly environment. Each environment (for example Development and Production) has its own key, and every call runs against the environment the key belongs to.

1. Sign in to the [Notifly dashboard](https://app.notifly.io).
2. Select the environment you want n8n to use.
3. Open **API Keys** in the sidebar and copy the **Secret Key**.
4. In n8n, create a new **Notifly API** credential and paste the key into **Secret Key**.
5. Leave **Base URL** as `https://api.notifly.io` unless you run a self-hosted Notifly.

n8n checks the credential by listing your workflows (`GET /v2/workflows`). The key is sent as the `Authorization: ApiKey <secret key>` header.

Use a Development environment key while you build a workflow, so test runs never reach real users.

## Operations

### Event

| Operation | What it does | Notifly API |
| --- | --- | --- |
| Trigger | Trigger a workflow for one subscriber or every subscriber of a topic. You can pass a payload, create or update the subscriber's details on the fly, set an actor, a tenant, a transaction ID and channel overrides. | `POST /v1/events/trigger` |
| Trigger Many | Trigger up to 100 events in one request, from a JSON array. | `POST /v1/events/trigger/bulk` |
| Broadcast | Trigger a workflow for every subscriber in the environment. | `POST /v1/events/trigger/broadcast` |
| Cancel | Cancel a pending event (for example a delayed or digested one) by its transaction ID. | `DELETE /v1/events/trigger/{transactionId}` |

### Subscriber

| Operation | What it does | Notifly API |
| --- | --- | --- |
| Create | Create a subscriber with a subscriber ID and optional email, phone, name, locale, timezone, avatar and custom data. | `POST /v2/subscribers` |
| Get | Retrieve a subscriber. | `GET /v2/subscribers/{subscriberId}` |
| Get Many | List or search subscribers by email, name, phone or subscriber ID. | `GET /v2/subscribers` |
| Update | Update a subscriber's profile. | `PATCH /v2/subscribers/{subscriberId}` |
| Delete | Delete a subscriber. | `DELETE /v2/subscribers/{subscriberId}` |
| Get Preferences | Retrieve global and per-workflow channel preferences. | `GET /v2/subscribers/{subscriberId}/preferences` |
| Update Preferences | Turn email, SMS, push, chat or in-app on or off, globally or for one workflow. | `PATCH /v2/subscribers/{subscriberId}/preferences` |

### Topic

| Operation | What it does | Notifly API |
| --- | --- | --- |
| Create | Create a topic with a key, name and custom data. | `POST /v2/topics` |
| Get | Retrieve a topic. | `GET /v2/topics/{topicKey}` |
| Get Many | List topics, filtered by key or name. | `GET /v2/topics` |
| Update | Rename a topic or change its custom data. | `PATCH /v2/topics/{topicKey}` |
| Delete | Delete a topic. | `DELETE /v2/topics/{topicKey}` |
| Add Subscribers | Subscribe one or more subscribers to a topic. | `POST /v2/topics/{topicKey}/subscriptions` |
| Remove Subscribers | Unsubscribe one or more subscribers from a topic. | `DELETE /v2/topics/{topicKey}/subscriptions` |

### Workflow

| Operation | What it does | Notifly API |
| --- | --- | --- |
| Get | Retrieve a workflow, including its steps and payload schema. | `GET /v2/workflows/{workflowId}` |
| Get Many | List workflows, filtered by search text, status or tags, with sorting. | `GET /v2/workflows` |

Every **Workflow** and **Topic** field in the node is a dropdown loaded from your Notifly environment. You can also switch it to **By ID** and type the identifier.

### Notification

| Operation | What it does | Notifly API |
| --- | --- | --- |
| Get | Retrieve a notification with each delivery step and its status. | `GET /v1/notifications/{notificationId}` |
| Get Many | List notification activity, filtered by channel, workflow, subscriber, topic, transaction ID and date range. | `GET /v1/notifications` |

**Simplify** is on by default for subscriber, workflow and notification reads. It returns the most useful fields. Turn it off to get the full API response.

## Trigger

**Notifly Trigger** has one event, **New Notification Event**. It polls `GET /v1/notifications` on the schedule you set in the node and emits each new notification once.

- When you activate the workflow, the trigger starts from that moment. It does not replay older notifications.
- It remembers the newest notification it has seen, so each notification is emitted once, even when several share a timestamp.
- You can filter by channel, workflow, subscriber ID or topic key.
- When you select **Fetch Test Event**, it returns the most recent matching notification, so you can map its fields.
- Each poll reads up to 1,000 new notifications. If more arrive between two polls, shorten the polling interval.

Notifly doesn't offer outbound webhooks yet, so this trigger uses polling. Every poll is one or more API calls against your Notifly plan.

## Usage example

**Send a welcome notification when someone signs up.**

1. Add the trigger that receives your sign-ups, for example a **Webhook** node or your form tool's trigger.
2. Add a **Notifly** node:
   - **Resource**: Event
   - **Operation**: Trigger
   - **Workflow**: pick your `welcome` workflow from the list
   - **Send To**: Subscriber
   - **Subscriber ID**: `{{ $json.userId }}`
   - **Payload**: `{ "firstName": "{{ $json.firstName }}", "plan": "{{ $json.plan }}" }`
   - **Subscriber Details > Email**: `{{ $json.email }}`
3. Run the workflow. Notifly creates the subscriber if needed and sends the welcome notification on every channel the workflow defines.

**Log notification activity.** Start with **Notifly Trigger**, filter on the workflow you care about, and send each new notification to Slack, a CRM or a spreadsheet.

**Keep topics in sync with your CRM.** When a contact joins a list in your CRM, use **Topic > Add Subscribers** to add the contact to the matching Notifly topic. Then trigger events to the whole topic with **Send To: Topic**.

## Use as an AI Agent tool

The **Notifly** node can be used as a tool by n8n's AI Agent node. The agent can then, for example, look up a subscriber, update their preferences or trigger a notification workflow on its own. Connect the node to the agent's **Tool** input and describe in the tool description what the agent is allowed to do.

## Compatibility

- Built with the `@n8n/node-cli` scaffold, n8n Nodes API version 1.
- Tested with n8n 2.x. AI Agent tool use needs an n8n version that supports `usableAsTool`.
- Works with Notifly Cloud (`https://api.notifly.io`) and self-hosted Notifly.
- No runtime dependencies.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Notifly](https://notifly.io)
- [Notifly API reference (OpenAPI)](https://api.notifly.io/openapi.json)

## License

[MIT](LICENSE.md)

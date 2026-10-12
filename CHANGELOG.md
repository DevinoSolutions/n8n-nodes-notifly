# Changelog

## 0.1.0

First release.

- **Notifly API** credential: environment secret key and Base URL, tested with `GET /v2/workflows`.
- **Notifly** node (declarative, usable as an AI Agent tool):
  - Event: Trigger, Trigger Many, Broadcast, Cancel.
  - Subscriber: Create, Get, Get Many, Update, Delete, Get Preferences, Update Preferences.
  - Topic: Create, Get, Get Many, Update, Delete, Add Subscribers, Remove Subscribers.
  - Workflow: Get, Get Many. Workflow and topic fields are dropdowns loaded from Notifly.
  - Notification: Get, Get Many.
- **Notifly Trigger** node: polling trigger "New Notification Event" over `GET /v1/notifications`, with a cursor and de-duplication kept in the workflow's static data.

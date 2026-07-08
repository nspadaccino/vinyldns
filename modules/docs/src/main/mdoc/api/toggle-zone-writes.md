---
layout: docs
title: "Disable / Enable Zone Writes"
section: "api"
---

# Disable / Enable Zone Writes

Used to temporarily pause or resume DNS changes to an individual zone. This is useful during
operational activities such as migrating a zone on the backend DNS server, where changes should not
be accepted while the work is in progress.

While a zone is disabled for writes its `status` is set to `Disabled`. In this state:

- Record set add, update, and delete requests to the zone are rejected with a `409 Conflict`.
- Batch changes that target the zone are rejected for the affected changes.
- Manual and scheduled zone syncs for the zone are skipped.
- The zone remains fully readable and its metadata can still be updated.

Enabling the zone returns its `status` to `Active` and DNS changes are accepted again.

Only a super user, support user, or a member of the zone's admin group may toggle the write status.
The toggle is recorded as an `Update` change in the zone change history.

#### HTTP REQUEST

> POST /zones/{zoneId}/disable

> POST /zones/{zoneId}/enable

#### HTTP RESPONSE TYPES

Code          | description |
 ------------ | :---------- |
202           | **Accepted** - The change was accepted and queued; the zone change is returned in the response body |
400           | **Bad Request** - The zone is in a state that cannot be toggled (for example, currently syncing or deleted) |
401           | **Unauthorized** - The authentication information provided is invalid |
403           | **Forbidden** - The user does not have the access required to perform the action |
404           | **Not Found** - Zone not found |
409           | **Conflict** - The zone is currently unavailable |

#### HTTP RESPONSE ATTRIBUTES

name          | type          | description |
 ------------ | ------------- | :---------- |
status        | string        | Change status |
zone          | map           | Refer to [zone model](zone-model.html); `status` will be `Disabled` after disabling and `Active` after enabling |
created       | string        | The timestamp (UTC) the change was initiated |
changeType    | string        | Type of change requested; in this case Update |
userId        | string        | The user ID that initiated the change |
id            | string        | The ID of the change.  This is not the id of the zone |

#### EXAMPLE RESPONSE

```json
{
  "status": "Pending",
  "zone": {
    "status": "Disabled",
    "updated": "2016-12-28T19:22:02Z",
    "name": "example.com.",
    "adminGroupId": "cf00d1e4-46f1-493a-a3be-0ae79dd306a5",
    "created": "2016-12-28T19:22:01Z",
    "account": "cf00d1e4-46f1-493a-a3be-0ae79dd306a5",
    "email": "test@test.com",
    "shared": false,
    "acl": {
      "rules": []
    },
    "id": "621a13df-a2e3-4394-84c0-3eb3a664dff4"
  },
  "created": "2016-12-28T19:22:02Z",
  "changeType": "Update",
  "userId": "ok",
  "id": "03f1ee91-9053-4346-8b53-e0f6042600f2"
}
```

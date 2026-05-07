---
id: "card-remove-type-prefixes-from-generated-ids-1yz32nh"
boardId: "default"
title: "Remove type prefixes from generated ids"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "backlog"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:33:48.779Z"
updatedAt: "2026-05-07T11:33:48.779Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
---
Stop using ids like `card-slug-suffixid` or `agent_ULID` as primary identifiers. Use plain ids for entities, and use polymorphic keys only when a value needs type context.

Example: an author reference can be represented as `agent:ulid` or `user:ulid`, but card ids themselves do not need a `card-` prefix.

Acceptance:
- New card and agent ids avoid redundant type prefixes where the entity type is already known by context.
- Polymorphic references use an explicit typed-key format only where mixed entity types are possible.
- Existing prefixed ids remain readable through compatibility/migration.
- APIs and storage docs clarify the id format rules.
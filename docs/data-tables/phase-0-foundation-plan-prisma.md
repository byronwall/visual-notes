# Phase 0 Detailed Plan: Data Tables Foundations + Prisma Schema Proposal

## 1. Objective
Define and ship the foundational data model for Notion-style tables so Phase 1 can render and edit real persisted tables immediately.

This phase should deliver:
- Stable table/column/row/cell persistence.
- View configuration persistence for table UX state.
- Type-safe column definitions for the MVP type subset.
- A migration path that supports future relations/rollups without schema rewrites.

## 2. Scope for Phase 0
In scope:
- Prisma schema additions (new enums + models).
- Initial migration generated via Prisma CLI.
- Backward-compatible linkage to existing note/document model (`Doc`).
- Query/index strategy for expected Phase 1 and Phase 2 access patterns.

Out of scope:
- Relation/rollup execution engine.
- Formula language.
- Charts and non-table views.

## 3. Design Constraints from Current Repo
- Existing canonical note entity is `Doc`; new table records should reuse this where possible.
- Prisma + Postgres are already established.
- Existing product uses `cuid()` IDs, `createdAt`, `updatedAt`, and indexed lookups.
- Existing time-block feature uses optional note linkage via `noteId -> Doc.id`.

## 4. Data Model Decisions (Phase 0)
1. Table rows are first-class records (`DataTableRow`) with required `title`.
2. Each row may link to a rich notes body via optional `noteId` (`Doc` relation).
3. Column definitions are strongly typed with an enum (`DataTableColumnType`).
4. Cell values use a hybrid storage model for MVP speed and queryability:
   - `valueJson` as canonical payload.
   - selective typed columns (`valueText`, `valueNumber`, `valueBoolean`, `valueDate`) for fast filter/sort support.
5. Table view settings are stored as JSON blobs in `DataTableView` (filters/sorts/visibility/order/widths).
6. Foundation includes relation metadata tables now (without full runtime features) to avoid churn later.

## 5. Proposed Prisma Changes

## 5.1 New Enums
```prisma
enum DataTableColumnType {
  title
  text
  number
  select
  multi_select
  date
  checkbox
  created_time
  updated_time
  relation
  rollup
}

enum DataTableViewType {
  table
}

enum DataTableRollupOp {
  count
  sum
  avg
  min
  max
}
```

## 5.2 New Models
```prisma
model DataTable {
  id          String   @id @default(cuid())
  name        String
  description String?
  noteId      String?
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  note     Doc?               @relation(fields: [noteId], references: [id], onDelete: SetNull)
  columns  DataTableColumn[]
  rows     DataTableRow[]
  views    DataTableView[]
  outgoing DataTableRelation[] @relation("DataTableRelationSource")
  incoming DataTableRelation[] @relation("DataTableRelationTarget")

  @@index([createdAt])
  @@index([noteId])
}

model DataTableView {
  id          String            @id @default(cuid())
  tableId     String
  name        String
  type        DataTableViewType @default(table)
  isDefault   Boolean           @default(false)
  config      Json              @default("{}")
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  table DataTable @relation(fields: [tableId], references: [id], onDelete: Cascade)

  @@index([tableId, updatedAt])
  @@unique([tableId, name])
}

model DataTableColumn {
  id              String              @id @default(cuid())
  tableId         String
  name            String
  key             String
  type            DataTableColumnType
  position        Int
  isRequired      Boolean             @default(false)
  isReadonly      Boolean             @default(false)
  settings        Json                @default("{}")
  relationConfig  DataTableRelation?
  rollupConfig    DataTableRollup?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  table DataTable @relation(fields: [tableId], references: [id], onDelete: Cascade)
  cells DataTableCell[]

  @@unique([tableId, key])
  @@index([tableId, position])
  @@index([tableId, type])
}

model DataTableRow {
  id          String   @id @default(cuid())
  tableId     String
  title       String
  noteId      String?
  position    Int?
  createdById String?
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  table DataTable      @relation(fields: [tableId], references: [id], onDelete: Cascade)
  note  Doc?           @relation(fields: [noteId], references: [id], onDelete: SetNull)
  cells DataTableCell[]

  @@index([tableId, createdAt])
  @@index([tableId, updatedAt])
  @@index([tableId, position])
  @@index([noteId])
}

model DataTableCell {
  id           String    @id @default(cuid())
  rowId        String
  columnId     String
  valueJson    Json      @default("null")
  valueText    String?
  valueNumber  Decimal?
  valueBoolean Boolean?
  valueDate    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  row    DataTableRow    @relation(fields: [rowId], references: [id], onDelete: Cascade)
  column DataTableColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)

  @@unique([rowId, columnId])
  @@index([columnId, valueText])
  @@index([columnId, valueNumber])
  @@index([columnId, valueBoolean])
  @@index([columnId, valueDate])
}

model DataTableRelation {
  id               String   @id @default(cuid())
  sourceTableId    String
  sourceColumnId   String   @unique
  targetTableId    String
  allowMultiple    Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  sourceTable  DataTable @relation("DataTableRelationSource", fields: [sourceTableId], references: [id], onDelete: Cascade)
  sourceColumn DataTableColumn @relation(fields: [sourceColumnId], references: [id], onDelete: Cascade)
  targetTable  DataTable @relation("DataTableRelationTarget", fields: [targetTableId], references: [id], onDelete: Cascade)

  @@index([sourceTableId])
  @@index([targetTableId])
}

model DataTableRelationValue {
  id                String   @id @default(cuid())
  relationId        String
  sourceRowId       String
  targetRowId       String
  createdAt         DateTime @default(now())

  relation  DataTableRelation @relation(fields: [relationId], references: [id], onDelete: Cascade)

  @@unique([relationId, sourceRowId, targetRowId])
  @@index([sourceRowId])
  @@index([targetRowId])
}

model DataTableRollup {
  id                    String            @id @default(cuid())
  tableId               String
  columnId              String            @unique
  relationColumnId      String
  targetColumnId        String?
  op                    DataTableRollupOp
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  table DataTable       @relation(fields: [tableId], references: [id], onDelete: Cascade)
  column DataTableColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)

  @@index([tableId])
  @@index([relationColumnId])
}
```

## 5.3 Changes to Existing `Doc` Model
Add reverse relations so table entities can link to rich note documents:

```prisma
model Doc {
  // existing fields...

  dataTables    DataTable[]
  dataTableRows DataTableRow[]

  // existing indexes...
}
```

## 6. Why This Schema Works for Your Goals
- Captures Notion-like row/page duality: table row + optional rich `Doc` body.
- Keeps MVP fast: JSON payload flexibility plus typed index columns for query speed.
- Avoids premature formula complexity while enabling future relation/rollup growth.
- Supports per-view UX customization without introducing view-specific data duplication.

## 7. Migration Plan (Detailed)

## 7.1 Migration 1: Core Tables
Create:
- `DataTable`
- `DataTableView`
- `DataTableColumn`
- `DataTableRow`
- `DataTableCell`
- new enums used by these models

Also update `Doc` relation fields.

Command:
```bash
cd app && pnpm prisma migrate dev --name add_data_tables_core
```

## 7.2 Migration 2: Relation/Rollup Foundation
Create:
- `DataTableRelation`
- `DataTableRelationValue`
- `DataTableRollup`
- `DataTableRollupOp` enum

Command:
```bash
cd app && pnpm prisma migrate dev --name add_data_table_relations_rollups
```

Rationale for split:
- Keeps first migration focused and easier to rollback.
- Lets Phase 1 ship independently if relation work is delayed.

## 8. Seed and Bootstrap Requirements (Phase 0)
Create seed helpers to produce:
1. One table named `Tasks`.
2. Default columns:
   - `title` (type `title`, required)
   - `status` (type `select`, options: todo/in_progress/done)
   - `dueDate` (type `date`)
3. One default table view (`All tasks`) with basic visible column config.
4. 20 sample rows with mixed statuses and due dates.

## 9. Validation and Quality Gates
Before closing Phase 0:
1. `cd app && pnpm prisma validate`
2. `cd app && pnpm prisma migrate dev` runs cleanly on a fresh DB.
3. `cd app && pnpm lint`
4. `cd app && pnpm type-check`
5. Smoke checks:
   - create table
   - add column
   - insert row + cells
   - edit date/number/select values
   - query rows sorted by date and filtered by select

## 10. Implementation Checklist (Execution Order)
1. Add enums and core models to `app/prisma/schema.prisma`.
2. Add `Doc` reverse relations.
3. Generate core migration.
4. Build seed utility for sample table.
5. Add minimal query/action service scaffolding (`data-tables.queries.ts`, `data-tables.actions.ts`).
6. Add relation/rollup models and second migration.
7. Re-run validation gates.

## 11. Open Decisions to Confirm Before Coding
1. Multi-tenant boundary: should `DataTable` include `userId` now, or rely on note linkage and app-level auth constraints?
2. Should `DataTableRow.noteId` auto-create a `Doc` row on row creation, or lazy-create on first row-detail open?
3. For `Decimal` numbers, do you want strict precision/scale now (e.g., `@db.Decimal(18,6)`) or defer?
4. Should select option definitions live only in `DataTableColumn.settings` JSON (current plan), or normalized in a dedicated `DataTableSelectOption` table?

## 12. Recommended Defaults
- Keep `DataTableRow.noteId` lazy-created to reduce write amplification.
- Keep select options in `settings` JSON for MVP speed.
- Add `userId` to `DataTable` in Phase 0 if per-user ownership rules are already required in backend services.
- Split migration into core + relation/rollup to preserve delivery flexibility.

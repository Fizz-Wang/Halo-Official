CREATE TABLE `acquisition_capabilities` (
	`capability_digest` text PRIMARY KEY NOT NULL,
	`lineage_key` text NOT NULL,
	`node_key` text NOT NULL,
	`session_digest` text NOT NULL,
	`intent` text NOT NULL,
	`canonical_route` text NOT NULL,
	`post_action` text NOT NULL,
	`logical_id` text NOT NULL,
	`generation` integer NOT NULL,
	`source_kind` text NOT NULL,
	`issued_at` integer NOT NULL,
	`source_expires_at` integer NOT NULL,
	`valid_until` integer NOT NULL,
	`proof_cleanup_after` integer NOT NULL,
	`source_cleanup_after` integer NOT NULL,
	`revoked_at` integer,
	`attestation_version` integer NOT NULL,
	`attestation_key_id` text NOT NULL,
	`authorization_attestation` text NOT NULL,
	FOREIGN KEY (`lineage_key`) REFERENCES `acquisition_lineages`(`lineage_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_key`) REFERENCES `acquisition_nodes`(`node_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_key`,`lineage_key`,`logical_id`,`generation`) REFERENCES `acquisition_nodes`(`node_key`,`lineage_key`,`logical_id`,`generation`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineage_key`,`session_digest`,`intent`,`canonical_route`,`post_action`) REFERENCES `acquisition_lineages`(`lineage_key`,`session_digest`,`intent`,`canonical_route`,`post_action`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_acquisition_capabilities_generation" CHECK("acquisition_capabilities"."generation" >= 0),
	CONSTRAINT "ck_acquisition_capabilities_intent" CHECK("acquisition_capabilities"."intent" IN ('poc', 'sales', 'demo', 'partner')),
	CONSTRAINT "ck_acquisition_capabilities_route_action" CHECK(("acquisition_capabilities"."intent" = 'poc' AND "acquisition_capabilities"."canonical_route" = '/request-poc/' AND "acquisition_capabilities"."post_action" = '/request-poc/') OR ("acquisition_capabilities"."intent" = 'sales' AND "acquisition_capabilities"."canonical_route" = '/contact-sales/' AND "acquisition_capabilities"."post_action" = '/contact-sales/') OR ("acquisition_capabilities"."intent" = 'demo' AND "acquisition_capabilities"."canonical_route" = '/request-demo/' AND "acquisition_capabilities"."post_action" = '/request-demo/') OR ("acquisition_capabilities"."intent" = 'partner' AND "acquisition_capabilities"."canonical_route" = '/partners/apply/' AND "acquisition_capabilities"."post_action" = '/partners/apply/')),
	CONSTRAINT "ck_acquisition_capabilities_lifecycle" CHECK("acquisition_capabilities"."issued_at" <= "acquisition_capabilities"."source_expires_at" AND "acquisition_capabilities"."source_expires_at" <= "acquisition_capabilities"."valid_until" AND "acquisition_capabilities"."valid_until" <= "acquisition_capabilities"."proof_cleanup_after" AND "acquisition_capabilities"."proof_cleanup_after" <= "acquisition_capabilities"."source_cleanup_after"),
	CONSTRAINT "ck_acquisition_capabilities_source_kind" CHECK("acquisition_capabilities"."source_kind" IN ('initial', 'validation', 'backend_failure', 'unknown', 'possible_duplicate')),
	CONSTRAINT "ck_acquisition_capabilities_attestation" CHECK("acquisition_capabilities"."attestation_version" = 1 AND length("acquisition_capabilities"."attestation_key_id") > 0 AND length("acquisition_capabilities"."authorization_attestation") > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_acquisition_capabilities_binding` ON `acquisition_capabilities` (`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_capabilities_cleanup_after` ON `acquisition_capabilities` (`proof_cleanup_after`);--> statement-breakpoint
CREATE TABLE `acquisition_dispatch_observations` (
	`observation_key` text PRIMARY KEY NOT NULL,
	`operation_key` text NOT NULL,
	`observation_digest` text NOT NULL,
	`outcome` text NOT NULL,
	`evidence_digest` text,
	`acknowledged_at` integer,
	`observed_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	FOREIGN KEY (`operation_key`) REFERENCES `acquisition_dispatch_operations`(`operation_key`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_acquisition_dispatch_observations_outcome" CHECK("acquisition_dispatch_observations"."outcome" IN ('recorded', 'not_recorded', 'indeterminate')),
	CONSTRAINT "ck_acquisition_dispatch_observations_evidence" CHECK(("acquisition_dispatch_observations"."outcome" IN ('recorded', 'not_recorded') AND "acquisition_dispatch_observations"."evidence_digest" IS NOT NULL AND length("acquisition_dispatch_observations"."evidence_digest") > 0 AND "acquisition_dispatch_observations"."acknowledged_at" IS NOT NULL AND "acquisition_dispatch_observations"."acknowledged_at" <= "acquisition_dispatch_observations"."observed_at") OR ("acquisition_dispatch_observations"."outcome" = 'indeterminate' AND "acquisition_dispatch_observations"."acknowledged_at" IS NULL AND ("acquisition_dispatch_observations"."evidence_digest" IS NULL OR length("acquisition_dispatch_observations"."evidence_digest") > 0))),
	CONSTRAINT "ck_acquisition_dispatch_observations_lifecycle" CHECK("acquisition_dispatch_observations"."observed_at" <= "acquisition_dispatch_observations"."cleanup_after")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_dispatch_observations_operation_digest` ON `acquisition_dispatch_observations` (`operation_key`,`observation_digest`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_dispatch_observations_binding` ON `acquisition_dispatch_observations` (`observation_key`,`operation_key`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_dispatch_observations_truth` ON `acquisition_dispatch_observations` (`operation_key`,`outcome`,`observed_at`);--> statement-breakpoint
CREATE TABLE `acquisition_dispatch_operations` (
	`operation_key` text PRIMARY KEY NOT NULL,
	`dispatch_key` text NOT NULL,
	`lineage_key` text NOT NULL,
	`logical_id` text NOT NULL,
	`source_node_key` text NOT NULL,
	`source_generation` integer NOT NULL,
	`candidate_fingerprint` text NOT NULL,
	`payload_snapshot_ref` text NOT NULL,
	`authorization_observation_key` text,
	`operation_kind` text NOT NULL,
	`reserved_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	FOREIGN KEY (`source_node_key`) REFERENCES `acquisition_nodes`(`node_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dispatch_key`,`lineage_key`,`logical_id`) REFERENCES `acquisition_dispatches`(`dispatch_key`,`lineage_key`,`logical_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_key`,`lineage_key`,`source_generation`) REFERENCES `acquisition_nodes`(`node_key`,`lineage_key`,`generation`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logical_id`,`lineage_key`) REFERENCES `acquisition_logical_ids`(`logical_id`,`lineage_key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_acquisition_dispatch_operations_kind" CHECK("acquisition_dispatch_operations"."operation_kind" IN ('dispatch', 'reconcile')),
	CONSTRAINT "ck_acquisition_dispatch_operations_generation" CHECK("acquisition_dispatch_operations"."source_generation" >= 0),
	CONSTRAINT "ck_acquisition_dispatch_operations_lifecycle" CHECK("acquisition_dispatch_operations"."reserved_at" <= "acquisition_dispatch_operations"."cleanup_after"),
	CONSTRAINT "ck_acquisition_dispatch_operations_binding" CHECK(length("acquisition_dispatch_operations"."candidate_fingerprint") > 0 AND length("acquisition_dispatch_operations"."payload_snapshot_ref") > 0 AND ("acquisition_dispatch_operations"."authorization_observation_key" IS NULL OR length("acquisition_dispatch_operations"."authorization_observation_key") > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_dispatch_operations_source_kind` ON `acquisition_dispatch_operations` (`source_node_key`,`operation_kind`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_dispatch_operations_dispatch` ON `acquisition_dispatch_operations` (`dispatch_key`,`reserved_at`);--> statement-breakpoint
CREATE TABLE `acquisition_dispatches` (
	`dispatch_key` text PRIMARY KEY NOT NULL,
	`lineage_key` text NOT NULL,
	`origin_node_key` text NOT NULL,
	`intent` text NOT NULL,
	`logical_id` text NOT NULL,
	`origin_generation` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`destination_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	FOREIGN KEY (`lineage_key`) REFERENCES `acquisition_lineages`(`lineage_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_node_key`) REFERENCES `acquisition_nodes`(`node_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logical_id`,`lineage_key`) REFERENCES `acquisition_logical_ids`(`logical_id`,`lineage_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`origin_node_key`,`lineage_key`,`origin_generation`) REFERENCES `acquisition_nodes`(`node_key`,`lineage_key`,`generation`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lineage_key`,`intent`) REFERENCES `acquisition_lineages`(`lineage_key`,`intent`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_acquisition_dispatches_generation" CHECK("acquisition_dispatches"."origin_generation" >= 0),
	CONSTRAINT "ck_acquisition_dispatches_intent" CHECK("acquisition_dispatches"."intent" IN ('poc', 'sales', 'demo', 'partner')),
	CONSTRAINT "ck_acquisition_dispatches_lifecycle" CHECK("acquisition_dispatches"."created_at" <= "acquisition_dispatches"."cleanup_after"),
	CONSTRAINT "ck_acquisition_dispatches_idempotency" CHECK("acquisition_dispatches"."idempotency_key" = "acquisition_dispatches"."logical_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_dispatches_intent_logical_id` ON `acquisition_dispatches` (`intent`,`logical_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_dispatches_idempotency_key` ON `acquisition_dispatches` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_dispatches_identity_binding` ON `acquisition_dispatches` (`dispatch_key`,`lineage_key`,`logical_id`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_dispatches_cleanup_after` ON `acquisition_dispatches` (`cleanup_after`);--> statement-breakpoint
CREATE TABLE `acquisition_lineages` (
	`lineage_key` text PRIMARY KEY NOT NULL,
	`session_digest` text NOT NULL,
	`intent` text NOT NULL,
	`canonical_route` text NOT NULL,
	`post_action` text NOT NULL,
	`root_logical_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	CONSTRAINT "ck_acquisition_lineages_revision" CHECK("acquisition_lineages"."revision" >= 0),
	CONSTRAINT "ck_acquisition_lineages_intent" CHECK("acquisition_lineages"."intent" IN ('poc', 'sales', 'demo', 'partner')),
	CONSTRAINT "ck_acquisition_lineages_route_action" CHECK(("acquisition_lineages"."intent" = 'poc' AND "acquisition_lineages"."canonical_route" = '/request-poc/' AND "acquisition_lineages"."post_action" = '/request-poc/') OR ("acquisition_lineages"."intent" = 'sales' AND "acquisition_lineages"."canonical_route" = '/contact-sales/' AND "acquisition_lineages"."post_action" = '/contact-sales/') OR ("acquisition_lineages"."intent" = 'demo' AND "acquisition_lineages"."canonical_route" = '/request-demo/' AND "acquisition_lineages"."post_action" = '/request-demo/') OR ("acquisition_lineages"."intent" = 'partner' AND "acquisition_lineages"."canonical_route" = '/partners/apply/' AND "acquisition_lineages"."post_action" = '/partners/apply/')),
	CONSTRAINT "ck_acquisition_lineages_lifecycle" CHECK("acquisition_lineages"."created_at" <= "acquisition_lineages"."expires_at" AND "acquisition_lineages"."expires_at" <= "acquisition_lineages"."cleanup_after")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_lineages_root_logical_id` ON `acquisition_lineages` (`root_logical_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_lineages_binding` ON `acquisition_lineages` (`lineage_key`,`session_digest`,`intent`,`canonical_route`,`post_action`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_lineages_intent_binding` ON `acquisition_lineages` (`lineage_key`,`intent`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_lineages_cleanup_after` ON `acquisition_lineages` (`cleanup_after`);--> statement-breakpoint
CREATE TABLE `acquisition_logical_ids` (
	`logical_id` text PRIMARY KEY NOT NULL,
	`lineage_key` text NOT NULL,
	`parent_logical_id` text,
	`created_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	FOREIGN KEY (`lineage_key`) REFERENCES `acquisition_lineages`(`lineage_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_logical_id`,`lineage_key`) REFERENCES `acquisition_logical_ids`(`logical_id`,`lineage_key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_acquisition_logical_ids_lifecycle" CHECK("acquisition_logical_ids"."created_at" <= "acquisition_logical_ids"."cleanup_after")
);
--> statement-breakpoint
CREATE INDEX `idx_acquisition_logical_ids_lineage` ON `acquisition_logical_ids` (`lineage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_logical_ids_lineage_binding` ON `acquisition_logical_ids` (`logical_id`,`lineage_key`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_logical_ids_cleanup_after` ON `acquisition_logical_ids` (`cleanup_after`);--> statement-breakpoint
CREATE TABLE `acquisition_nodes` (
	`node_key` text PRIMARY KEY NOT NULL,
	`lineage_key` text NOT NULL,
	`parent_node_key` text,
	`logical_id` text NOT NULL,
	`generation` integer NOT NULL,
	`source_kind` text DEFAULT 'initial' NOT NULL,
	`outcome` text DEFAULT 'fresh' NOT NULL,
	`bound_payload_fingerprint` text,
	`selected_candidate_fingerprint` text,
	`selected_payload_snapshot_ref` text,
	`selected_logical_id` text,
	`selected_node_key` text,
	`result_set_key` text,
	`selection_key` text,
	`finalization_key` text,
	`selection_kind` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	FOREIGN KEY (`lineage_key`) REFERENCES `acquisition_lineages`(`lineage_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`logical_id`) REFERENCES `acquisition_logical_ids`(`logical_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_set_key`) REFERENCES `acquisition_result_sets`(`result_set_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_node_key`,`lineage_key`) REFERENCES `acquisition_nodes`(`node_key`,`lineage_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logical_id`,`lineage_key`) REFERENCES `acquisition_logical_ids`(`logical_id`,`lineage_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_logical_id`,`lineage_key`) REFERENCES `acquisition_logical_ids`(`logical_id`,`lineage_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_node_key`,`lineage_key`) REFERENCES `acquisition_nodes`(`node_key`,`lineage_key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_acquisition_nodes_generation" CHECK("acquisition_nodes"."generation" >= 0),
	CONSTRAINT "ck_acquisition_nodes_revision" CHECK("acquisition_nodes"."revision" >= 0),
	CONSTRAINT "ck_acquisition_nodes_selection_key" CHECK("acquisition_nodes"."selection_key" IS NULL OR length("acquisition_nodes"."selection_key") > 0),
	CONSTRAINT "ck_acquisition_nodes_finalization_key" CHECK("acquisition_nodes"."finalization_key" IS NULL OR length("acquisition_nodes"."finalization_key") > 0),
	CONSTRAINT "ck_acquisition_nodes_source_kind" CHECK("acquisition_nodes"."source_kind" IN ('initial', 'validation', 'backend_failure', 'unknown', 'possible_duplicate')),
	CONSTRAINT "ck_acquisition_nodes_source_binding" CHECK((("acquisition_nodes"."source_kind" IN ('initial', 'validation')) AND "acquisition_nodes"."bound_payload_fingerprint" IS NULL) OR (("acquisition_nodes"."source_kind" IN ('backend_failure', 'unknown', 'possible_duplicate')) AND "acquisition_nodes"."bound_payload_fingerprint" IS NOT NULL AND length("acquisition_nodes"."bound_payload_fingerprint") > 0)),
	CONSTRAINT "ck_acquisition_nodes_outcome" CHECK("acquisition_nodes"."outcome" IN ('fresh', 'validation_failed', 'ready', 'recorded', 'not_recorded', 'indeterminate')),
	CONSTRAINT "ck_acquisition_nodes_selection_kind" CHECK("acquisition_nodes"."selection_kind" IS NULL OR "acquisition_nodes"."selection_kind" IN ('parent', 'child')),
	CONSTRAINT "ck_acquisition_nodes_selection_shape" CHECK(("acquisition_nodes"."selection_kind" IS NULL AND "acquisition_nodes"."selected_candidate_fingerprint" IS NULL AND "acquisition_nodes"."selected_payload_snapshot_ref" IS NULL AND "acquisition_nodes"."selected_logical_id" IS NULL) OR ("acquisition_nodes"."selection_kind" IS NOT NULL AND "acquisition_nodes"."selected_candidate_fingerprint" IS NOT NULL AND length("acquisition_nodes"."selected_candidate_fingerprint") > 0 AND "acquisition_nodes"."selected_payload_snapshot_ref" IS NOT NULL AND length("acquisition_nodes"."selected_payload_snapshot_ref") > 0 AND "acquisition_nodes"."selected_logical_id" IS NOT NULL AND (("acquisition_nodes"."selection_kind" = 'parent' AND "acquisition_nodes"."selected_logical_id" = "acquisition_nodes"."logical_id") OR ("acquisition_nodes"."selection_kind" = 'child' AND "acquisition_nodes"."selected_logical_id" <> "acquisition_nodes"."logical_id")))),
	CONSTRAINT "ck_acquisition_nodes_selection_phase" CHECK(("acquisition_nodes"."outcome" = 'fresh' AND "acquisition_nodes"."selection_kind" IS NULL) OR ("acquisition_nodes"."outcome" <> 'fresh' AND "acquisition_nodes"."selection_kind" IS NOT NULL)),
	CONSTRAINT "ck_acquisition_nodes_result_set" CHECK(("acquisition_nodes"."outcome" IN ('fresh', 'ready') AND "acquisition_nodes"."result_set_key" IS NULL) OR ("acquisition_nodes"."outcome" IN ('validation_failed', 'recorded', 'not_recorded', 'indeterminate') AND "acquisition_nodes"."result_set_key" IS NOT NULL AND length("acquisition_nodes"."result_set_key") > 0)),
	CONSTRAINT "ck_acquisition_nodes_lifecycle" CHECK("acquisition_nodes"."created_at" <= "acquisition_nodes"."updated_at" AND "acquisition_nodes"."updated_at" <= "acquisition_nodes"."cleanup_after" AND "acquisition_nodes"."expires_at" <= "acquisition_nodes"."cleanup_after")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_lineage_generation` ON `acquisition_nodes` (`lineage_key`,`generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_full_binding` ON `acquisition_nodes` (`node_key`,`lineage_key`,`logical_id`,`generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_lineage_binding` ON `acquisition_nodes` (`node_key`,`lineage_key`,`generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_parent_binding` ON `acquisition_nodes` (`node_key`,`lineage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_finalization_key` ON `acquisition_nodes` (`finalization_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_selection_key` ON `acquisition_nodes` (`selection_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_nodes_result_set_key` ON `acquisition_nodes` (`result_set_key`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_nodes_lineage_parent` ON `acquisition_nodes` (`lineage_key`,`parent_node_key`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_nodes_outcome_updated` ON `acquisition_nodes` (`outcome`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_nodes_cleanup_after` ON `acquisition_nodes` (`cleanup_after`);--> statement-breakpoint
CREATE TABLE `acquisition_result_authorizations` (
	`handle_digest` text PRIMARY KEY NOT NULL,
	`session_digest` text NOT NULL,
	`intent` text NOT NULL,
	`canonical_route` text NOT NULL,
	`post_action` text NOT NULL,
	`logical_id` text NOT NULL,
	`generation` integer NOT NULL,
	`representation` text NOT NULL,
	`public_state` text NOT NULL,
	`source_kind` text,
	`proof_class` text NOT NULL,
	`result_set_key` text NOT NULL,
	`return_handle_digest` text,
	`delivery_proof_digest` text,
	`operation_key` text,
	`observation_key` text,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	`attestation_version` integer NOT NULL,
	`attestation_key_id` text NOT NULL,
	`authorization_attestation` text NOT NULL,
	FOREIGN KEY (`handle_digest`) REFERENCES `acquisition_result_handles`(`handle_digest`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_set_key`,`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`) REFERENCES `acquisition_result_sets`(`result_set_key`,`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`observation_key`,`operation_key`) REFERENCES `acquisition_dispatch_observations`(`observation_key`,`operation_key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_acquisition_result_authorizations_generation" CHECK("acquisition_result_authorizations"."generation" >= 0),
	CONSTRAINT "ck_acquisition_result_authorizations_route_action" CHECK(("acquisition_result_authorizations"."intent" = 'poc' AND "acquisition_result_authorizations"."canonical_route" = '/request-poc/' AND "acquisition_result_authorizations"."post_action" = '/request-poc/') OR ("acquisition_result_authorizations"."intent" = 'sales' AND "acquisition_result_authorizations"."canonical_route" = '/contact-sales/' AND "acquisition_result_authorizations"."post_action" = '/contact-sales/') OR ("acquisition_result_authorizations"."intent" = 'demo' AND "acquisition_result_authorizations"."canonical_route" = '/request-demo/' AND "acquisition_result_authorizations"."post_action" = '/request-demo/') OR ("acquisition_result_authorizations"."intent" = 'partner' AND "acquisition_result_authorizations"."canonical_route" = '/partners/apply/' AND "acquisition_result_authorizations"."post_action" = '/partners/apply/')),
	CONSTRAINT "ck_acquisition_result_authorizations_shape" CHECK(("acquisition_result_authorizations"."public_state" = 'validation' AND "acquisition_result_authorizations"."proof_class" = 'validation' AND "acquisition_result_authorizations"."source_kind" = 'validation' AND "acquisition_result_authorizations"."operation_key" IS NULL AND "acquisition_result_authorizations"."observation_key" IS NULL AND "acquisition_result_authorizations"."delivery_proof_digest" IS NULL) OR ("acquisition_result_authorizations"."public_state" = 'backend_failure' AND "acquisition_result_authorizations"."proof_class" = 'not_recorded' AND "acquisition_result_authorizations"."source_kind" = 'backend_failure' AND "acquisition_result_authorizations"."operation_key" IS NOT NULL AND "acquisition_result_authorizations"."observation_key" IS NOT NULL AND "acquisition_result_authorizations"."delivery_proof_digest" IS NOT NULL) OR ("acquisition_result_authorizations"."public_state" IN ('return_form', 'unknown') AND "acquisition_result_authorizations"."proof_class" = 'indeterminate_dispatch' AND "acquisition_result_authorizations"."source_kind" = 'unknown' AND "acquisition_result_authorizations"."operation_key" IS NOT NULL AND "acquisition_result_authorizations"."observation_key" IS NOT NULL AND "acquisition_result_authorizations"."delivery_proof_digest" IS NOT NULL) OR ("acquisition_result_authorizations"."public_state" IN ('return_form', 'possible_duplicate') AND "acquisition_result_authorizations"."proof_class" = 'indeterminate_reconcile' AND "acquisition_result_authorizations"."source_kind" = 'possible_duplicate' AND "acquisition_result_authorizations"."operation_key" IS NOT NULL AND "acquisition_result_authorizations"."observation_key" IS NOT NULL AND "acquisition_result_authorizations"."delivery_proof_digest" IS NOT NULL) OR ("acquisition_result_authorizations"."public_state" = 'receipt' AND "acquisition_result_authorizations"."proof_class" = 'recorded' AND "acquisition_result_authorizations"."source_kind" IS NOT NULL AND "acquisition_result_authorizations"."operation_key" IS NOT NULL AND "acquisition_result_authorizations"."observation_key" IS NOT NULL AND "acquisition_result_authorizations"."delivery_proof_digest" IS NOT NULL) OR ("acquisition_result_authorizations"."public_state" = 'expired' AND "acquisition_result_authorizations"."proof_class" = 'exact_expiry' AND "acquisition_result_authorizations"."source_kind" IS NULL AND "acquisition_result_authorizations"."operation_key" IS NULL AND "acquisition_result_authorizations"."observation_key" IS NULL AND "acquisition_result_authorizations"."delivery_proof_digest" IS NULL)),
	CONSTRAINT "ck_acquisition_result_authorizations_representation_state" CHECK(("acquisition_result_authorizations"."representation" = 'returned_form' AND "acquisition_result_authorizations"."public_state" IN ('validation', 'backend_failure', 'return_form')) OR ("acquisition_result_authorizations"."representation" = 'reduced' AND "acquisition_result_authorizations"."public_state" IN ('unknown', 'possible_duplicate', 'expired', 'receipt'))),
	CONSTRAINT "ck_acquisition_result_authorizations_return_target" CHECK(("acquisition_result_authorizations"."public_state" IN ('unknown', 'possible_duplicate') AND "acquisition_result_authorizations"."return_handle_digest" IS NOT NULL) OR ("acquisition_result_authorizations"."public_state" NOT IN ('unknown', 'possible_duplicate') AND "acquisition_result_authorizations"."return_handle_digest" IS NULL)),
	CONSTRAINT "ck_acquisition_result_authorizations_lifecycle" CHECK("acquisition_result_authorizations"."issued_at" <= "acquisition_result_authorizations"."expires_at" AND "acquisition_result_authorizations"."expires_at" <= "acquisition_result_authorizations"."cleanup_after"),
	CONSTRAINT "ck_acquisition_result_authorizations_attestation" CHECK("acquisition_result_authorizations"."attestation_version" = 1 AND length("acquisition_result_authorizations"."attestation_key_id") > 0 AND length("acquisition_result_authorizations"."authorization_attestation") > 0 AND length("acquisition_result_authorizations"."result_set_key") > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_acquisition_result_authorizations_binding` ON `acquisition_result_authorizations` (`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_result_authorizations_cleanup_after` ON `acquisition_result_authorizations` (`cleanup_after`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_result_authorizations_state_binding` ON `acquisition_result_authorizations` (`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`,`public_state`) WHERE "acquisition_result_authorizations"."public_state" = 'expired';--> statement-breakpoint
CREATE TABLE `acquisition_result_handles` (
	`handle_digest` text PRIMARY KEY NOT NULL,
	`lineage_key` text,
	`node_key` text,
	`session_digest` text NOT NULL,
	`intent` text NOT NULL,
	`canonical_route` text NOT NULL,
	`post_action` text NOT NULL,
	`logical_id` text NOT NULL,
	`generation` integer NOT NULL,
	`representation` text NOT NULL,
	`public_state` text NOT NULL,
	`return_handle_digest` text,
	`payload_fingerprint` text,
	`result_set_key` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	FOREIGN KEY (`lineage_key`) REFERENCES `acquisition_lineages`(`lineage_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_key`) REFERENCES `acquisition_nodes`(`node_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_key`,`lineage_key`,`logical_id`,`generation`) REFERENCES `acquisition_nodes`(`node_key`,`lineage_key`,`logical_id`,`generation`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineage_key`,`session_digest`,`intent`,`canonical_route`,`post_action`) REFERENCES `acquisition_lineages`(`lineage_key`,`session_digest`,`intent`,`canonical_route`,`post_action`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_set_key`,`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`) REFERENCES `acquisition_result_sets`(`result_set_key`,`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`return_handle_digest`,`lineage_key`,`node_key`,`logical_id`,`generation`) REFERENCES `acquisition_result_handles`(`handle_digest`,`lineage_key`,`node_key`,`logical_id`,`generation`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_acquisition_handles_generation" CHECK("acquisition_result_handles"."generation" >= 0),
	CONSTRAINT "ck_acquisition_handles_intent" CHECK("acquisition_result_handles"."intent" IN ('poc', 'sales', 'demo', 'partner')),
	CONSTRAINT "ck_acquisition_handles_route_action" CHECK(("acquisition_result_handles"."intent" = 'poc' AND "acquisition_result_handles"."canonical_route" = '/request-poc/' AND "acquisition_result_handles"."post_action" = '/request-poc/') OR ("acquisition_result_handles"."intent" = 'sales' AND "acquisition_result_handles"."canonical_route" = '/contact-sales/' AND "acquisition_result_handles"."post_action" = '/contact-sales/') OR ("acquisition_result_handles"."intent" = 'demo' AND "acquisition_result_handles"."canonical_route" = '/request-demo/' AND "acquisition_result_handles"."post_action" = '/request-demo/') OR ("acquisition_result_handles"."intent" = 'partner' AND "acquisition_result_handles"."canonical_route" = '/partners/apply/' AND "acquisition_result_handles"."post_action" = '/partners/apply/')),
	CONSTRAINT "ck_acquisition_handles_representation" CHECK("acquisition_result_handles"."representation" IN ('returned_form', 'reduced')),
	CONSTRAINT "ck_acquisition_handles_representation_state" CHECK(("acquisition_result_handles"."representation" = 'returned_form' AND "acquisition_result_handles"."public_state" IN ('validation', 'backend_failure', 'return_form')) OR ("acquisition_result_handles"."representation" = 'reduced' AND "acquisition_result_handles"."public_state" IN ('unknown', 'possible_duplicate', 'expired', 'receipt'))),
	CONSTRAINT "ck_acquisition_handles_public_state" CHECK("acquisition_result_handles"."public_state" IN ('validation', 'backend_failure', 'return_form', 'unknown', 'possible_duplicate', 'expired', 'receipt')),
	CONSTRAINT "ck_acquisition_handles_uncertainty_return" CHECK(("acquisition_result_handles"."public_state" IN ('unknown', 'possible_duplicate') AND "acquisition_result_handles"."return_handle_digest" IS NOT NULL) OR ("acquisition_result_handles"."public_state" NOT IN ('unknown', 'possible_duplicate') AND "acquisition_result_handles"."return_handle_digest" IS NULL)),
	CONSTRAINT "ck_acquisition_handles_lifecycle" CHECK("acquisition_result_handles"."issued_at" <= "acquisition_result_handles"."expires_at" AND "acquisition_result_handles"."expires_at" <= "acquisition_result_handles"."cleanup_after"),
	CONSTRAINT "ck_acquisition_handles_expiry_only" CHECK("acquisition_result_handles"."public_state" <> 'expired' OR ("acquisition_result_handles"."lineage_key" IS NULL AND "acquisition_result_handles"."node_key" IS NULL AND "acquisition_result_handles"."payload_fingerprint" IS NULL)),
	CONSTRAINT "ck_acquisition_handles_state_binding" CHECK(("acquisition_result_handles"."public_state" IN ('validation', 'backend_failure', 'return_form', 'unknown', 'possible_duplicate') AND "acquisition_result_handles"."lineage_key" IS NOT NULL AND "acquisition_result_handles"."node_key" IS NOT NULL AND "acquisition_result_handles"."payload_fingerprint" IS NOT NULL AND length("acquisition_result_handles"."payload_fingerprint") > 0) OR ("acquisition_result_handles"."public_state" = 'receipt' AND "acquisition_result_handles"."lineage_key" IS NOT NULL AND "acquisition_result_handles"."node_key" IS NOT NULL AND "acquisition_result_handles"."payload_fingerprint" IS NULL) OR ("acquisition_result_handles"."public_state" = 'expired' AND "acquisition_result_handles"."lineage_key" IS NULL AND "acquisition_result_handles"."node_key" IS NULL AND "acquisition_result_handles"."payload_fingerprint" IS NULL)),
	CONSTRAINT "ck_acquisition_handles_result_set" CHECK(length("acquisition_result_handles"."result_set_key") > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_acquisition_handles_node` ON `acquisition_result_handles` (`node_key`);--> statement-breakpoint
CREATE INDEX `idx_acquisition_handles_cleanup_after` ON `acquisition_result_handles` (`cleanup_after`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_handles_full_binding` ON `acquisition_result_handles` (`handle_digest`,`lineage_key`,`node_key`,`logical_id`,`generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_handles_expired_binding` ON `acquisition_result_handles` (`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`,`public_state`) WHERE "acquisition_result_handles"."public_state" = 'expired';--> statement-breakpoint
CREATE TABLE `acquisition_result_sets` (
	`result_set_key` text PRIMARY KEY NOT NULL,
	`session_digest` text NOT NULL,
	`intent` text NOT NULL,
	`canonical_route` text NOT NULL,
	`post_action` text NOT NULL,
	`logical_id` text NOT NULL,
	`generation` integer NOT NULL,
	`outcome` text NOT NULL,
	`created_at` integer NOT NULL,
	`cleanup_after` integer NOT NULL,
	CONSTRAINT "ck_acquisition_result_sets_route_action" CHECK(("acquisition_result_sets"."intent" = 'poc' AND "acquisition_result_sets"."canonical_route" = '/request-poc/' AND "acquisition_result_sets"."post_action" = '/request-poc/') OR ("acquisition_result_sets"."intent" = 'sales' AND "acquisition_result_sets"."canonical_route" = '/contact-sales/' AND "acquisition_result_sets"."post_action" = '/contact-sales/') OR ("acquisition_result_sets"."intent" = 'demo' AND "acquisition_result_sets"."canonical_route" = '/request-demo/' AND "acquisition_result_sets"."post_action" = '/request-demo/') OR ("acquisition_result_sets"."intent" = 'partner' AND "acquisition_result_sets"."canonical_route" = '/partners/apply/' AND "acquisition_result_sets"."post_action" = '/partners/apply/')),
	CONSTRAINT "ck_acquisition_result_sets_shape" CHECK(length("acquisition_result_sets"."result_set_key") > 0 AND "acquisition_result_sets"."generation" >= 0 AND "acquisition_result_sets"."outcome" IN ('validation', 'backend_failure', 'unknown', 'possible_duplicate', 'receipt', 'expired')),
	CONSTRAINT "ck_acquisition_result_sets_lifecycle" CHECK("acquisition_result_sets"."created_at" <= "acquisition_result_sets"."cleanup_after")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_result_sets_full_binding` ON `acquisition_result_sets` (`result_set_key`,`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_acquisition_result_sets_expired_binding` ON `acquisition_result_sets` (`session_digest`,`intent`,`canonical_route`,`post_action`,`logical_id`,`generation`,`outcome`) WHERE "acquisition_result_sets"."outcome" = 'expired';--> statement-breakpoint
CREATE INDEX `idx_acquisition_result_sets_cleanup_after` ON `acquisition_result_sets` (`cleanup_after`);
# Contoso Permit Services - Architecture Brief

## Case identity

Contoso is Microsoft's familiar fictitious company name used in examples. Contoso Permit Services is
a fictional regional public-service organisation in the Netherlands. This case is synthetic and
contains no real customer, employee, subscription, credential, or personal data.

## Business context

Contoso coordinates permit applications and field inspections for local infrastructure work.
Requests currently arrive through email and web forms, then move between spreadsheets, shared
mailboxes, and a scheduling tool. Applicants cannot consistently see status, and managers have limited
end-to-end insight into ageing cases and missed inspection appointments.

The organisation wants an Azure-based solution that:

- provides one intake and case-status experience;
- coordinates triage, document review, inspection scheduling, and decisions;
- gives applicants timely notifications;
- gives managers auditable process and service-level insight;
- reduces average handling time by a target of 30% without reducing control quality.

The executive sponsor is the Director of Public Services. Business process owners, information
security, privacy/legal, operations, field inspectors, applicants, and the enterprise platform team
must be represented. Budget, delivery deadline, benefit baseline, and accountable product owner are
not yet confirmed.

## Data

Expected data includes applicant contact details, addresses and work locations, permit metadata,
uploaded plans and photographs, inspection appointments, field notes, decisions, and audit events.
Some data is personal. Exact classification, authoritative sources, data-quality ownership, expected
volumes, attachment sizes, retention, deletion, records-management rules, and permitted analytics use
remain to be confirmed.

All test and demonstration activity must use synthetic data. The organisation operates in the
Netherlands; privacy/legal must confirm which legal and public-record obligations apply rather than
the architecture team assuming them.

## Application

Expected users are applicants, case workers, inspectors, managers, and support staff. The desired
journey covers submission, validation, triage, review, inspection planning, field update, decision,
notification, and status enquiry.

Potential integrations include Microsoft Entra ID for workforce identity, an existing public website,
email/SMS notifications, a geographic information service, a finance system for fees, and a document
archive. These are not yet confirmed as mandatory, and interface owners, protocols, service levels,
and test facilities are unknown.

Accessibility, multilingual support, mobile/offline inspection behaviour, payment handling, and
external-user identity require human decisions.

## Technology

Microsoft Azure is the approved cloud platform. The brief mentions App Service, API Management,
Azure SQL, Storage, Service Bus, and Power BI as suggestions, not mandatory selections.

Contoso reports that an enterprise Azure landing zone exists, but no management-group,
subscription, connectivity, identity, policy, naming, tagging, or monitoring evidence has been
provided. The solution must not invent that topology.

Availability, recovery objectives, peak load, performance thresholds, environments, production
region, support hours, cost ceiling, and operational ownership remain open. Database services must
not be publicly accessible.

## Security and compliance

The workforce uses Microsoft Entra ID. External identity, privileged access, segregation of duties,
data encryption, key ownership, audit retention, threat model, incident response, and security
monitoring responsibilities remain to be confirmed.

The case may involve privacy, accessibility, public-record, procurement, and operational-resilience
obligations. AFF-B must derive potential applicability from evidence and obtain human legal/compliance
confirmation before treating an obligation as mandatory.

## Delivery and execution boundaries

- Bicep is the preferred IaC language unless confirmed enterprise standards require another approach.
- The deployment procedure must support manual human execution or explicit AFF-7 execution.
- GitHub OIDC and stored deployment credentials are out of scope.
- No Azure deployment or live runtime test is authorised by this brief.
- Phase 7 and Phase 8 remain optional and require their own human invocation and scoped approval.
- The C-level presentation ends the standard route and must not imply deployment or runtime testing.

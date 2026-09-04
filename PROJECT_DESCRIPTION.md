# Survey Platform

## 1. Overview

The Survey Platform is a multi-clinic survey application for clinics and similar organizations. Multiple users can create, manage, distribute, and evaluate surveys for different clinics from one central system.

The application will initially focus on medical surveys, such as patient satisfaction surveys. Surveys should be reusable: the same questionnaire can be used by multiple clinics and campaigns while each campaign can have its own branding, title, text, and recipient list.

The administration interface and participant-facing experience will be available in German.

## 2. Main Use Case

An administrator or authorized clinic user creates a reusable survey containing sections and different question types. The survey can then be published through one or more campaigns.

For example:

```text
Praxis A
└── Patientenzufriedenheit
    ├── Öffentlicher Link
    └── E-Mail-Kampagne August
```

The public link can be used with QR codes, websites, flyers, or tablets in the practice. An email campaign sends every recipient a unique personal link so invitation and participation status can be tracked.

## 3. Distribution Methods

### Public Link

Each public campaign can have a readable URL, for example:

```text
umfrage.domain.de/praxis-a/patientenzufriedenheit
```

Anyone with the link can participate. Public responses are anonymous by default.

The administration interface should provide:

- Copy public link
- Generate or download a QR code
- Configure an expiry date or active period
- View response count
- Configure campaign-specific branding

### Email Campaign

Recipients can be imported from a file or added individually. Each recipient receives a unique link containing a secure, non-guessable token.

The system should track:

- Recipient imported or created
- Invitation pending
- Email sent
- Email delivery failure
- Link opened
- Survey started
- Survey completed
- Unsubscribed or excluded, where applicable

The system must not expose recipient data through public URLs.

## 4. Survey and Campaign Separation

A survey is the reusable questionnaire definition. It contains:

- Sections
- Questions
- Answer options
- Validation rules
- Required and optional questions
- Display order
- Conditional visibility, when supported
- Identity and anonymity policy

A campaign is a specific distribution of a survey. It contains:

- Clinic or organization
- Distribution method
- Public slug or recipient links
- Campaign title and introduction
- Logo, colors, background, and other branding
- Email template, for email campaigns
- Recipient list
- Start and end dates
- Campaign status
- Response and delivery statistics

The survey definition must be versioned. Once a version has received responses, it must not be changed. Editing creates a new draft version so existing answers always remain connected to the exact questionnaire that was shown.

## 5. Anonymity and Privacy

The survey defines the default response identity mode:

- Anonymous: answers are not connected to a person.
- Identified: answers may be connected to the recipient or authenticated participant.

For email campaigns, the system may know which recipients were invited, sent a message, opened the link, or completed the survey. The campaign can additionally enable “Antworten anonymisieren.” In that case, participation status remains available, but individual answers must not be linked to a recipient.

An anonymous survey must never become identifiable through an administrative report, export, event log, or API response.

Because the initial use case involves medical clinics, privacy, retention, access control, encryption, backups, and GDPR requirements must be reviewed before production use. The application should avoid collecting unnecessary patient-identifying information.

## 6. Users, Clinics, and Permissions

The platform supports multiple clinics and multiple users. Users can belong to one or more clinics and receive role-based permissions.

Permissions should be abstract capabilities, for example:

- Manage users
- Manage roles
- Manage clinics
- Create and edit surveys
- Publish surveys
- Manage campaigns
- Manage recipients
- View responses
- View analytics
- Export data
- View audit logs

Only administrators can assign roles and permissions. Every security-sensitive action must be auditable.

## 7. Reporting and Analytics

Each campaign should provide a clear dashboard showing:

- Invitations and delivery status
- Open rate
- Start rate
- Completion rate
- Number of responses
- Response trend over time
- Question-level results

Charts should be supported for multiple choice, yes/no, rating, scale, numeric, and date questions. Text questions should be available in an answer table with search, filtering, pagination, and optional basic summaries such as answer count and response length distribution.

Users should be able to export campaign results as:

- Excel (`.xlsx`) for detailed data and further analysis
- PDF for a presentation-ready report containing campaign information, charts, summaries, and selected text answers where permitted

Exports should respect permissions and anonymity settings.

## 8. Language and Hosting

The initial product language is German, including labels, validation messages, email templates, exports, and participant-facing pages.

The application will be hosted on a single VPS in Europe. The frontend and backend may run on the same server, with PostgreSQL as the primary database. Deployment should use containers and automated backups. The design should leave room to move storage, workers, or services to separate infrastructure later without requiring a rewrite.

## 9. Initial Product Boundaries

The first release should focus on:

- Clinic and user administration
- Reusable survey creation
- Sections and core question types
- Draft and published survey versions
- Public campaigns
- Email campaigns with unique recipient links
- Anonymous and identified response modes
- Audit logging
- Basic campaign analytics
- PDF and Excel exports

Advanced features such as complex branching logic, multilingual surveys, SMS distribution, integrations, white-labeling, and advanced text analysis can be added after the core workflow is stable.

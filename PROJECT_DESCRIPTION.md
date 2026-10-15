# OpenPulse: product description

## 1. Overview

OpenPulse is a multi-tenant survey application for teams and organizations. Multiple users can create, manage, distribute, and evaluate surveys for different workspaces (client accounts, teams, projects, or locations) from one central system.

The product is industry-neutral and suits use cases such as customer satisfaction, event feedback, and community surveys. Surveys are reusable: the same questionnaire can be used by multiple workspaces and campaigns while each campaign can have its own branding, title, text, and recipient list.

The administration interface and the participant-facing experience are English-first, with a German translation.

## 2. Main Use Case

An administrator or platform user authorized for a workspace creates a reusable survey containing sections and different question types. The survey can then be published through one or more campaigns.

For example:

```text
Workspace A
└── Customer satisfaction survey
    ├── Public link
    └── Email campaign, August
```

The public link can be used with QR codes, websites, flyers, or tablets in the practice. An email campaign sends every recipient a unique personal link so invitation and participation status can be tracked.

## 3. Distribution Methods

### Public Link

Each public campaign can have a readable URL, for example:

```text
openpulse.example.com/demo-workspace/satisfaction-survey
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

- Workspace
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

Survey data can be sensitive, so privacy, retention, access control, encryption, backups, and the data-protection rules that apply to you (for example GDPR) must be reviewed before any production use. The application should avoid collecting unnecessary personally identifying information.

## 6. Users, Workspaces, and Permissions

The platform supports multiple workspaces and multiple users. Users can belong to one or more workspaces and receive role-based permissions. Workspaces belong to an organization, which owns the survey catalogue.

Permissions should be abstract capabilities, for example:

- Manage users
- Manage roles
- Manage workspaces
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

The interface is English-first with a German translation (`next-intl`, selectable from the language switcher). PDF and Excel exports and the default email templates are English only.

Version 0.1 is meant for local, self-hosted use with Docker Compose (PostgreSQL as the primary database); there is no supported production deployment yet. The design should leave room to move storage, workers, or services to separate infrastructure later without requiring a rewrite.

## 9. Initial Product Boundaries

The first release should focus on:

- Workspace and user administration
- Reusable survey creation
- Sections and core question types
- Draft and published survey versions
- Public campaigns
- Email campaigns with unique recipient links
- Anonymous responses (identified response mode is not implemented yet)
- Audit logging
- Basic campaign analytics
- PDF and Excel exports

Advanced features such as complex branching logic, multilingual surveys, SMS distribution, integrations, white-labeling, and advanced text analysis can be added after the core workflow is stable.

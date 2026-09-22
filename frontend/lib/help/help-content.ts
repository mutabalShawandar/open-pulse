export type HelpStep = {
  title: string;
  description: string;
};

export type HelpTopic = {
  title: string;
  steps: HelpStep[];
};

type HelpEntry = {
  test: (path: string) => boolean;
  topic: HelpTopic;
};

const helpEntries: HelpEntry[] = [
  {
    test: (path) => path === "/",
    topic: {
      title: "Übersicht",
      steps: [
        {
          title: "Willkommen im Arbeitsbereich",
          description:
            "Die Übersicht ist Ihr Startpunkt. Von hier gelangen Sie über die linke Navigation zu Umfragen, Kliniken und der Administration.",
        },
        {
          title: "Navigation nutzen",
          description:
            "Die Seitenleiste links zeigt alle Bereiche, auf die Sie Zugriff haben. Klicken Sie auf einen Eintrag, um dorthin zu wechseln.",
        },
        {
          title: "Nächster Schritt",
          description:
            "Beginnen Sie in der Regel mit „Umfragen“, um eine Vorlage zu erstellen, oder mit „Kliniken“, um einen Standort zu verwalten.",
        },
      ],
    },
  },
  {
    test: (path) => path === "/surveys",
    topic: {
      title: "Umfragenkatalog",
      steps: [
        {
          title: "Was ist der Katalog?",
          description:
            "Hier sehen Sie alle Umfragen der Agentur. Umfragen sind wiederverwendbar und gehören nicht einer einzelnen Klinik.",
        },
        {
          title: "Neue Umfrage anlegen",
          description:
            "Klicken Sie oben rechts auf „Neue Umfrage“, um einen ersten Entwurf zu erstellen.",
        },
        {
          title: "Status verstehen",
          description:
            "Umfragen können Entwurf, Veröffentlicht oder Archiviert sein. Nur veröffentlichte Versionen können Kliniken zugewiesen werden.",
        },
        {
          title: "Archiv anzeigen",
          description:
            "Mit dem Button „Archiv anzeigen“ blenden Sie archivierte Umfragen ein oder aus.",
        },
      ],
    },
  },
  {
    test: (path) => path === "/surveys/new",
    topic: {
      title: "Neue Umfrage erstellen",
      steps: [
        {
          title: "Grunddaten festlegen",
          description: "Vergeben Sie einen Titel und optional eine Beschreibung für die neue Umfrage.",
        },
        {
          title: "Entwurf wird angelegt",
          description:
            "Nach dem Speichern entsteht ein bearbeitbarer Entwurf, den Sie mit Abschnitten und Fragen füllen können.",
        },
        {
          title: "Weiter geht es im Editor",
          description:
            "Sie werden anschließend zum Entwurfs-Editor weitergeleitet, um Fragen, Optionen und Validierungsregeln zu ergänzen.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/surveys\/[^/]+\/drafts\/[^/]+$/.test(path),
    topic: {
      title: "Entwurf bearbeiten",
      steps: [
        {
          title: "Abschnitte und Fragen",
          description:
            "Strukturieren Sie die Umfrage in Abschnitte und fügen Sie typisierte Fragen (Text, Auswahl, Skala usw.) hinzu.",
        },
        {
          title: "Antwortoptionen & Validierung",
          description:
            "Bei Auswahlfragen definieren Sie die Antwortoptionen. Legen Sie zusätzlich Validierungsregeln wie Pflichtfelder fest.",
        },
        {
          title: "Reihenfolge anpassen",
          description: "Die Reihenfolge von Abschnitten und Fragen bestimmt, wie Teilnehmende die Umfrage später sehen.",
        },
        {
          title: "Veröffentlichen",
          description:
            "Sobald der Entwurf fertig ist, veröffentlichen Sie ihn. Veröffentlichte Versionen sind unveränderlich und können Kliniken zugewiesen werden.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/surveys\/[^/]+\/versions\/[^/]+$/.test(path),
    topic: {
      title: "Veröffentlichte Version",
      steps: [
        {
          title: "Unveränderliche Version",
          description:
            "Diese Ansicht zeigt eine veröffentlichte, fixierte Version der Umfrage. Inhalte können hier nicht mehr geändert werden.",
        },
        {
          title: "Kliniken zuweisen",
          description:
            "Weisen Sie diese Version einer oder mehreren Kliniken zu, damit dort Kampagnen darauf aufbauen können.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/surveys\/[^/]+$/.test(path),
    topic: {
      title: "Umfragedetails",
      steps: [
        {
          title: "Entwürfe & Versionen",
          description:
            "Hier sehen Sie alle Entwürfe und veröffentlichten Versionen dieser Umfrage sowie deren Status.",
        },
        {
          title: "Neuen Entwurf erstellen",
          description:
            "Sie können jederzeit einen neuen Entwurf aus dieser Umfrage oder einer bestehenden Version ableiten (Deep Copy).",
        },
        {
          title: "Archivieren",
          description: "Nicht mehr benötigte Umfragen können archiviert und bei Bedarf wiederhergestellt werden.",
        },
      ],
    },
  },
  {
    test: (path) => path === "/clinics",
    topic: {
      title: "Kliniken",
      steps: [
        {
          title: "Klinikverwaltung",
          description: "Diese Liste zeigt alle Kliniken, auf die Sie Zugriff haben, als eigenständige Mandanten.",
        },
        {
          title: "Neue Klinik anlegen",
          description: "Über „Neue Klinik“ legen Sie einen neuen Klinikstandort mit Basisdaten an.",
        },
        {
          title: "Klinik öffnen",
          description:
            "Klicken Sie auf eine Klinik, um Kampagnen, Empfänger und Analysen für diesen Standort zu verwalten.",
        },
      ],
    },
  },
  {
    test: (path) => path === "/clinics/new",
    topic: {
      title: "Neue Klinik anlegen",
      steps: [
        {
          title: "Stammdaten erfassen",
          description: "Geben Sie Name, Adresse und weitere Basisdaten der Klinik ein.",
        },
        {
          title: "Zuständigkeit",
          description:
            "Nach dem Anlegen können Sie Plattformbenutzer dieser Klinik zuordnen, damit diese dort arbeiten können.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+\/edit$/.test(path),
    topic: {
      title: "Klinik bearbeiten",
      steps: [
        {
          title: "Stammdaten aktualisieren",
          description: "Passen Sie Name, Adresse und weitere Angaben der Klinik an.",
        },
        {
          title: "Änderungen speichern",
          description: "Speichern Sie die Änderungen, damit sie in der gesamten Anwendung sichtbar werden.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+\/campaigns\/new$/.test(path),
    topic: {
      title: "Kampagne erstellen",
      steps: [
        {
          title: "Umfrageversion wählen",
          description:
            "Wählen Sie eine veröffentlichte Umfrageversion, die dieser Klinik bereits zugewiesen wurde. Kampagnen binden sich fest an genau diese Version.",
        },
        {
          title: "Branding festlegen",
          description: "Passen Sie das Erscheinungsbild der Kampagne an, z. B. Titel und Begrüßungstext für Teilnehmende.",
        },
        {
          title: "Empfänger auswählen",
          description: "Wählen Sie die aktiven Empfänger aus, die die Kampagne per E-Mail erhalten sollen.",
        },
        {
          title: "Öffentlicher Link",
          description:
            "Beim Erstellen wird zusätzlich ein nicht erratbarer öffentlicher Link erzeugt, über den anonym teilgenommen werden kann.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+\/campaigns\/[^/]+$/.test(path),
    topic: {
      title: "Kampagnendetails",
      steps: [
        {
          title: "Status verfolgen",
          description: "Hier sehen Sie den aktuellen Status der Kampagne sowie den öffentlichen Teilnahme-Link.",
        },
        {
          title: "Empfänger & Versand",
          description: "Prüfen Sie, an welche Empfänger die Kampagne gesendet wurde und wie der Zustellstatus ist.",
        },
        {
          title: "Auswertung",
          description: "Sobald Antworten vorliegen, finden Sie diese in der Analytics-Ansicht der Klinik.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+\/campaigns$/.test(path),
    topic: {
      title: "Kampagnen der Klinik",
      steps: [
        {
          title: "Kampagnenübersicht",
          description: "Alle Umfrage-Kampagnen dieser Klinik werden hier mit Status und Zeitraum aufgelistet.",
        },
        {
          title: "Neue Kampagne starten",
          description:
            "Über „Neue Kampagne“ binden Sie eine zugewiesene, veröffentlichte Umfrageversion an Empfänger dieser Klinik.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+\/recipients$/.test(path),
    topic: {
      title: "Empfänger",
      steps: [
        {
          title: "Empfängerliste pflegen",
          description: "Verwalten Sie die E-Mail-Empfänger dieser Klinik, die für Kampagnen ausgewählt werden können.",
        },
        {
          title: "Status beachten",
          description: "Nur aktive Empfänger stehen bei der Kampagnenerstellung zur Auswahl.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+\/analytics$/.test(path),
    topic: {
      title: "Analytics",
      steps: [
        {
          title: "Antworten auswerten",
          description: "Diese Ansicht fasst die eingegangenen Antworten der Kampagnen dieser Klinik zusammen.",
        },
        {
          title: "Export nutzen",
          description: "Sie können Ergebnisse als PDF oder Excel exportieren, um sie weiterzuverarbeiten.",
        },
      ],
    },
  },
  {
    test: (path) => /^\/clinics\/[^/]+$/.test(path),
    topic: {
      title: "Klinikübersicht",
      steps: [
        {
          title: "Zentrale Anlaufstelle",
          description: "Von hier erreichen Sie Kampagnen, Empfänger und Analysen dieser Klinik.",
        },
        {
          title: "Zugewiesene Umfragen",
          description: "Prüfen Sie, welche veröffentlichten Umfrageversionen dieser Klinik aktuell zugewiesen sind.",
        },
      ],
    },
  },
  {
    test: (path) => path === "/administration/users",
    topic: {
      title: "Benutzerverwaltung",
      steps: [
        {
          title: "Plattformbenutzer verwalten",
          description:
            "Ein gültiger Keycloak-Login allein gewährt keinen Zugriff. Benutzer müssen hier freigegeben und Rollen zugewiesen werden.",
        },
        {
          title: "Rollen & Klinikzuordnung",
          description: "Weisen Sie Benutzern Rollen zu und legen Sie fest, welche Kliniken sie verwalten dürfen.",
        },
      ],
    },
  },
  {
    test: (path) => path === "/administration/email",
    topic: {
      title: "E-Mail-Versand",
      steps: [
        {
          title: "SMTP-Konfiguration",
          description: "Hier konfigurieren Sie den E-Mail-Versand für Kampagnen-Einladungen.",
        },
        {
          title: "In Arbeit",
          description:
            "Der Empfänger-Import, Vorlagen und der zuverlässige Zustellstatus werden aktuell fertiggestellt (Phase 4).",
        },
      ],
    },
  },
];

const defaultTopic: HelpTopic = {
  title: "Hilfe",
  steps: [
    {
      title: "Kontexthilfe",
      description:
        "Für diesen Bereich gibt es noch keine spezifische Anleitung. Nutzen Sie die Navigation links, um zu Umfragen, Kliniken oder der Administration zu wechseln.",
    },
  ],
};

export function getHelpTopic(path: string): HelpTopic {
  const entry = helpEntries.find(({ test }) => test(path));
  return entry ? entry.topic : defaultTopic;
}

// Registro delle guide disponibili nel sistema.
// roles: array di department che possono vedere la guida (SUPERUSER bypassa sempre)
// id: deve corrispondere al nome del file in src/docs/{lang}/{id}.md

export const GUIDES = [
  {
    id: "admin-users",
    title: { it: "Gestione Utenti", en: "User Management" },
    description: {
      it: "Creazione, modifica, reset password e disattivazione utenti del sistema",
      en: "Create, edit, reset passwords and deactivate system users",
    },
    icon: "Users",
    roles: ["ADMIN"],
    category: { it: "Amministrazione", en: "Administration" },
  },
  {
    id: "rbac",
    title: { it: "Ruoli & Permessi", en: "Roles & Permissions" },
    description: {
      it: "Configurazione del sistema RBAC, assegnazione permessi e accessi granulari",
      en: "RBAC system configuration, permission assignment and granular access control",
    },
    icon: "Shield",
    roles: ["ADMIN"],
    category: { it: "Amministrazione", en: "Administration" },
  },
  {
    id: "tickets",
    title: { it: "Gestione Ticket", en: "Ticket Management" },
    description: {
      it: "Come aprire, gestire e risolvere i ticket di assistenza interna",
      en: "How to open, manage and resolve internal support tickets",
    },
    icon: "LifeBuoy",
    roles: ["ADMIN", "COMMERCIAL", "HR", "FINANCE", "MARKETING", "IT", "RETAIL", "MANAGER", "TOPMGR", "DM", "STORE", "STOREMANAGER"],
    category: { it: "Operativo", en: "Operations" },
  },
  {
    id: "sales",
    title: { it: "Dati Vendite", en: "Sales Data" },
    description: {
      it: "Importazione e consultazione dati vendite da Navision",
      en: "Import and view sales data from Navision",
    },
    icon: "BarChart2",
    roles: ["ADMIN", "COMMERCIAL", "HR", "FINANCE", "MARKETING", "IT", "RETAIL", "MANAGER", "TOPMGR"],
    category: { it: "Head Office", en: "Head Office" },
  },
]

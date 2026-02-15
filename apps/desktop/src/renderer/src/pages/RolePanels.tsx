import { ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS, type RoleId } from "@repo/shared";

const ROLES: RoleId[] = [
  "FARM_MANAGER",
  "FIELD_HAND",
  "FIELD_SCOUT",
  "GRAIN_ELEVATOR",
  "BELL_RINGER",
  "BARN_DOG",
  "HEEL",
  "BARN_CREW",
];

const ROLE_POLICIES: Record<RoleId, string[]> = {
  FARM_MANAGER: [
    "Can create work orders",
    "Can assign tasks",
    "Can request merges",
    "Can complete tasks",
  ],
  FIELD_HAND: [
    "Can work tasks",
    "Can submit draft artifacts",
    "CANNOT modify canonical artifacts",
  ],
  FIELD_SCOUT: [
    "Can triage/unblock tasks",
    "Can change task status",
    "CANNOT complete tasks",
  ],
  GRAIN_ELEVATOR: [
    "Can canonicalize artifacts",
    "Can request and perform merges",
    "Can modify canonical artifacts",
  ],
  BELL_RINGER: [
    "Can trigger ticks",
    "CANNOT create user-facing artifacts",
    "CANNOT complete tasks",
  ],
  BARN_DOG: [
    "Can perform maintenance",
    "Can update task status",
    "CANNOT complete tasks",
  ],
  HEEL: [
    "Can raise watchdog alerts",
    "Can update task status",
    "CANNOT complete tasks",
  ],
  BARN_CREW: [
    "Can work tasks",
    "Can submit artifacts",
    "Can complete tasks",
  ],
};

export function RolePanels() {
  return (
    <div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Role Panels
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1rem",
        }}
      >
        {ROLES.map((roleId) => (
          <div key={roleId} className="card">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              {ROLE_DISPLAY_NAMES[roleId]}
            </h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: "0.75rem",
              }}
            >
              {ROLE_DESCRIPTIONS[roleId]}
            </p>

            <div style={{ marginBottom: "0.5rem" }}>
              <h4
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Policies
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  fontSize: "0.8rem",
                }}
              >
                {ROLE_POLICIES[roleId].map((policy, i) => (
                  <li
                    key={i}
                    style={{
                      padding: "0.15rem 0",
                      color: policy.startsWith("CANNOT")
                        ? "var(--danger)"
                        : "var(--text)",
                    }}
                  >
                    {policy.startsWith("CANNOT") ? "✗ " : "✓ "}
                    {policy}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

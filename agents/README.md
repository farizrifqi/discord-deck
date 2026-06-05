# Agent Routing Guide

Use this explicit format to route tasks correctly.

## Primary Routing Format (Explicit)

```text
Use Fisch Value Agent: <value/trade task>
Use Web/Coding Agent: <web/app task>
```

You can send one or both in the same message.
If both are present, tasks are split and handled by the matching agent.

---

## Examples

### Combo task (both agents)

```text
Use Fisch Value Agent: rate trade Bunblade + 300M for Melodii.
Use Web/Coding Agent: add compact mobile mode in values.html.
```

### Value-only

```text
Use Fisch Value Agent: update Dutchman = 6.5B and re-rate Malevolence swap.
```

### Web-only

```text
Use Web/Coding Agent: fix reconnect overlay covering top controls.
```

---

## Flexible Aliases (Not Case-Sensitive)

You can use lowercase/uppercase freely. These are accepted aliases:

### Fisch Value Agent aliases
- `Use Fisch Value Agent:`
- `fisch value:`
- `value agent:`
- `fisch:` (when clearly about trade/value)

### Web/Coding Agent aliases
- `Use Web/Coding Agent:`
- `web:`
- `coding:`
- `web/coding:`

## Notes

- Routing is not case-sensitive.
- Fisch Value Agent handles valuation logic, trade verdicts, and value-sheet updates.
- Web/Coding Agent handles implementation, bug fixes, UI/UX, and app stability.
- If request is ambiguous, include one explicit routing line to avoid misrouting.

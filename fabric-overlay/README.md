# K4 Fabric Workload — Overlay for Extensibility Toolkit

## How to Use

After cloning Microsoft's Extensibility Toolkit:

```bash
git clone https://github.com/microsoft/fabric-extensibility-toolkit.git
cd fabric-extensibility-toolkit
```

Copy this overlay on top. From inside the repo root:

```bash
# This copies everything — the 3 replacement files + all K4ModelItem files
cp -r /path/to/fabric-overlay/Workload/* Workload/
```

That's it. Here's exactly what gets added/replaced:

### Replaced files (3):
- `Workload/app/App.tsx` — adds K4ModelItem route (keeps HelloWorld too)
- `Workload/Manifest/Product.json` — adds K4 Model card (keeps HelloWorld too)
- `Workload/Manifest/WorkloadManifest.xml` — sets EnableSandboxRelaxation=true

### New files (10):
- `Workload/app/items/K4ModelItem/K4ModelItemEditor.tsx`
- `Workload/app/items/K4ModelItem/K4ModelItemEmptyView.tsx`
- `Workload/app/items/K4ModelItem/K4ModelItemRibbon.tsx`
- `Workload/app/items/K4ModelItem/K4ModelItemDefinition.ts`
- `Workload/app/items/K4ModelItem/K4BridgeAdapter.ts`
- `Workload/app/items/K4ModelItem/K4AuthService.ts`
- `Workload/app/items/K4ModelItem/K4ModelItem.scss`
- `Workload/app/items/K4ModelItem/index.ts`
- `Workload/Manifest/items/K4ModelItem/K4ModelItem.json`
- `Workload/Manifest/items/K4ModelItem/K4ModelItem.xml`

### Nothing else is touched:
- All HelloWorld files remain intact
- All Starter Kit components, controllers, clients untouched
- package.json, webpack, devServer — all unchanged
- @k4/bridge is imported but must be added to node_modules (see below)

## After Copying

1. Add @k4/bridge to the project:
   ```bash
   # Option A: copy the built package into node_modules
   cp -r /path/to/k4-bridge/dist node_modules/@k4/bridge

   # Option B: link it locally during development
   cd /path/to/k4-bridge && npm link
   cd /path/to/fabric-extensibility-toolkit/Workload && npm link @k4/bridge
   ```

2. Run the Fabric setup:
   ```bash
   pwsh ./scripts/Setup/Setup.ps1 -WorkloadName "K4Analytics.Planning"
   ```

3. Start development:
   ```bash
   pwsh ./scripts/Run/StartDevServer.ps1    # Terminal 1
   pwsh ./scripts/Run/StartDevGateway.ps1   # Terminal 2
   ```

4. Open Fabric → Workload Hub → K4 Analytics → Create a K4 Model

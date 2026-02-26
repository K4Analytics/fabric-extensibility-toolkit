import React from "react";
import { Route, Router, Switch } from "react-router-dom";
import { History } from "history";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { HelloWorldItemEditor } from "./items/HelloWorldItem";
import { K4ModelItemEditor } from "./items/K4ModelItem";
import { ConditionalPlaygroundRoutes } from "./playground/ConditionalPlaygroundRoutes";

/*
    K4 Analytics Fabric Workload — App Routes

    Added K4ModelItem-editor route alongside the existing HelloWorld route.
    The HelloWorld route can be removed once K4 is working.
*/

interface AppProps {
    history: History;
    workloadClient: WorkloadClientAPI;
}

export interface PageProps {
    workloadClient: WorkloadClientAPI;
    history?: History;
}

export interface ContextProps {
    itemObjectId?: string;
    workspaceObjectId?: string;
    source?: string;
}

export interface SharedState {
    message: string;
}

export function App({ history, workloadClient }: AppProps) {
    return (
        <Router history={history}>
            <Route exact path="/">
                <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
                    <h1>K4 Analytics Workload</h1>
                    <p>Current URL: {window.location.href}</p>
                    <p>Workload Name: {process.env.WORKLOAD_NAME}</p>
                </div>
            </Route>
            <Switch>
                {/* K4 Model Item Editor */}
                <Route path="/K4ModelItem-editor/:itemObjectId">
                    <K4ModelItemEditor
                        workloadClient={workloadClient}
                        data-testid="K4ModelItem-editor"
                    />
                </Route>

                {/* Original HelloWorld (keep for testing, remove later) */}
                <Route path="/HelloWorldItem-editor/:itemObjectId">
                    <HelloWorldItemEditor
                        workloadClient={workloadClient}
                        data-testid="HelloWorldItem-editor"
                    />
                </Route>

                <ConditionalPlaygroundRoutes workloadClient={workloadClient} />
            </Switch>
        </Router>
    );
}

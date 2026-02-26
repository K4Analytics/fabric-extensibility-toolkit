/**
 * Interface representing the definition of a K4 Model item.
 * This information is stored in Fabric as Item definition (payload.json).
 * It maps the PBI visual's formatting settings to a Fabric-native schema.
 */
export interface K4ModelItemDefinition {
  // Connection settings (was: k4.settings.server, k4.settings.model)
  serverUrl?: string;
  modelId?: string;

  // Authentication (was: k4.settings.entraIdSSO, k4.settings.apiKey, k4.settings.k4user)
  entraIdSsoEnabled?: boolean;
  apiKey?: string;
  username?: string;

  // Properties (was: k4.properties.*)
  context?: string;
  dynamicRows?: string;
  loadMessage?: string;
  showCondition?: string;
  selectionFilters?: string;

  // Datasets (was: k4.datasets.mainDatasetName)
  mainDatasetName?: string;
}

/**
 * Default definition for new K4 Model items
 */
export const DEFAULT_K4_MODEL_DEFINITION: K4ModelItemDefinition = {
  entraIdSsoEnabled: true,
  mainDatasetName: "HOST",
};

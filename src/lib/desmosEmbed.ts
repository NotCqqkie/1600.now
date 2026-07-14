export interface DesmosBounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface DesmosTableColumn {
  latex: string;
  values: string[];
}

export interface DesmosTable {
  columns: DesmosTableColumn[];
}

export interface DesmosExpression {
  latex: string;
  id?: string;
  color?: string;
  label?: string;
  showLabel?: boolean;
  hidden?: boolean;
  sliderBounds?: {
    min: string;
    max: string;
    step: string;
  };
  playing?: boolean;
}

export type DesmosExpressionInput = string | DesmosExpression;

export interface DesmosEmbedConfig {
  expressions: DesmosExpressionInput[];
  tables?: DesmosTable[];
  bounds?: DesmosBounds;
  degreeMode?: boolean;
  defaultLogModeRegressions?: boolean;
  preserveSquareUnits?: boolean;
  showGraphpaper?: boolean;
}

export interface DesmosGraphConfig extends DesmosEmbedConfig {
  label?: string;
}

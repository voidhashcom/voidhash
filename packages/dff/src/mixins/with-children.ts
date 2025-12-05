// biome-ignore lint/suspicious/noExplicitAny: We need to be able to pass any arguments to the constructor
type Constructor<T = object> = new (...args: any[]) => T;

export interface WithChildrenCapability {
  readonly allowedChildTypes: readonly string[];
  canContain(nodeType: string): boolean;
}

export function WithChildren<TBase extends Constructor>(
  Base: TBase,
  allowedChildTypes: readonly string[]
) {
  return class WithChildrenClass
    extends Base
    implements WithChildrenCapability
  {
    readonly allowedChildTypes = allowedChildTypes;

    canContain(nodeType: string): boolean {
      return this.allowedChildTypes.includes(nodeType);
    }
  };
}

'use client';

import type { Schema } from 'effect';
import { Schema as S } from 'effect';
import {
  TextInput as BaseTextInput,
  type TextInputProps as BaseTextInputProps
} from '@/features/designer/components/text-input';

/**
 * Props for the node-aware TextInput wrapper.
 * Extends the base TextInput props but makes value/onChange work with node properties.
 */
export type NodeTextInputProps<T extends Record<string, unknown>> = {
  /** The node object containing the property to edit */
  node: T;
  /** Callback when the node should be updated */
  onNodeChange: (node: T) => void;
  /** The property key on the node to read/write */
  property: keyof T;
  /** Transform the node property value to a string for display */
  valueToString?: (value: T[keyof T]) => string;
  /** Transform the string input back to the node property type */
  stringToValue?: (value: string) => T[keyof T];
  /** Input type */
  type?: 'text' | 'number';
  /** Step increment for number type */
  typeNumberStepIncrement?: number;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Accessible label */
  label: string;
  /** Validation schema */
  validator?: Schema.Schema<string>;
  /** Additional class names */
  className?: string;
};

/**
 * Node-aware TextInput wrapper.
 * Provides convenient props for working with node objects in the designer panels.
 */
export function NodeTextInput<T extends Record<string, unknown>>({
  node,
  onNodeChange,
  property,
  valueToString = (v) => String(v),
  stringToValue = (v) => v as T[keyof T],
  type = 'text',
  typeNumberStepIncrement = 1,
  icon,
  label,
  validator = S.String,
  className
}: NodeTextInputProps<T>) {
  const value = valueToString(node[property]);

  const handleChange = (newValue: string) => {
    onNodeChange({
      ...node,
      [property]: stringToValue(newValue)
    });
  };

  return (
    <BaseTextInput
      className={className}
      icon={icon}
      label={label}
      onChange={handleChange}
      type={type}
      typeNumberStepIncrement={typeNumberStepIncrement}
      validator={validator}
      value={value}
    />
  );
}

/**
 * Re-export the base TextInput for direct usage when node logic is not needed.
 */
export { BaseTextInput as TextInput };
export type { BaseTextInputProps as TextInputProps };

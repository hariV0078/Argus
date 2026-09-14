import { Text, TextProps } from 'react-native';
import { type } from '@/src/theme';

type Variant = keyof typeof type;

export function T({
  variant = 'body',
  style,
  ...rest
}: TextProps & { variant?: Variant }) {
  return <Text style={[type[variant], style]} {...rest} />;
}

export function ColumnLayoutRenderer({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <pixiLayoutContainer
      layout={{
        flexDirection: 'column'
      }}
    >
      {children}
    </pixiLayoutContainer>
  );
}

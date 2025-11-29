export function RowLayoutRenderer({ children }: { children: React.ReactNode }) {
  return (
    <pixiLayoutContainer
      layout={{
        flexDirection: 'row'
      }}
    >
      {children}
    </pixiLayoutContainer>
  );
}

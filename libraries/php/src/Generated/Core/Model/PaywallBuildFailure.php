<?php

namespace Voidhash\Generated\Core\Model;

class PaywallBuildFailure
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * Why the build failed, in plain language.
     *
     * @var string
     */
    protected $message;
    /**
     * Each problem the compiler found; empty when the failure concerns no part of the design.
     *
     * @var list<FlowPackageDiagnostic>
     */
    protected $diagnostics;
    /**
     * Why the build failed, in plain language.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * Why the build failed, in plain language.
     *
     * @param string $message
     *
     * @return self
     */
    public function setMessage(string $message): self
    {
        $this->initialized['message'] = true;
        $this->message = $message;
        return $this;
    }
    /**
     * Each problem the compiler found; empty when the failure concerns no part of the design.
     *
     * @return list<FlowPackageDiagnostic>
     */
    public function getDiagnostics(): array
    {
        return $this->diagnostics;
    }
    /**
     * Each problem the compiler found; empty when the failure concerns no part of the design.
     *
     * @param list<FlowPackageDiagnostic> $diagnostics
     *
     * @return self
     */
    public function setDiagnostics(array $diagnostics): self
    {
        $this->initialized['diagnostics'] = true;
        $this->diagnostics = $diagnostics;
        return $this;
    }
}
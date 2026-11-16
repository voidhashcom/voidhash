<?php

namespace Voidhash\Generated\Core\Model;

class ComponentConformanceCheck
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
     * The check's name; `panel` for the check on the editor panel module.
     *
     * @var string
     */
    protected $name;
    /**
     * The check's outcome: `pass`, `warn` (passed with warnings), `fail` or `skip` (did not apply).
     *
     * @var string
     */
    protected $status;
    /**
     * What made the check fail; empty unless `status` is `fail`.
     *
     * @var list<string>
     */
    protected $errors;
    /**
     * What the check found that does not fail it.
     *
     * @var list<string>
     */
    protected $warnings;
    /**
     * The check's name; `panel` for the check on the editor panel module.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The check's name; `panel` for the check on the editor panel module.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The check's outcome: `pass`, `warn` (passed with warnings), `fail` or `skip` (did not apply).
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * The check's outcome: `pass`, `warn` (passed with warnings), `fail` or `skip` (did not apply).
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * What made the check fail; empty unless `status` is `fail`.
     *
     * @return list<string>
     */
    public function getErrors(): array
    {
        return $this->errors;
    }
    /**
     * What made the check fail; empty unless `status` is `fail`.
     *
     * @param list<string> $errors
     *
     * @return self
     */
    public function setErrors(array $errors): self
    {
        $this->initialized['errors'] = true;
        $this->errors = $errors;
        return $this;
    }
    /**
     * What the check found that does not fail it.
     *
     * @return list<string>
     */
    public function getWarnings(): array
    {
        return $this->warnings;
    }
    /**
     * What the check found that does not fail it.
     *
     * @param list<string> $warnings
     *
     * @return self
     */
    public function setWarnings(array $warnings): self
    {
        $this->initialized['warnings'] = true;
        $this->warnings = $warnings;
        return $this;
    }
}
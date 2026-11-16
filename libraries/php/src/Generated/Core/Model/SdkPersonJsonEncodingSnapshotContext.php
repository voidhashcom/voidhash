<?php

namespace Voidhash\Generated\Core\Model;

class SdkPersonJsonEncodingSnapshotContext
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
     * The ids of the persons whose access and history this response includes.
     *
     * @var list<string>
     */
    protected $includedPersonIds;
    /**
     * The id of the transfer still moving another person's purchases to this one; null when none is running.
     *
     * @var string|null
     */
    protected $migrationJobId;
    /**
     * `persisted` when the response shows only this person; `temporary_pending_transfer` when an identify is still moving the anonymous person's purchases over, and both are shown together until it finishes.
     *
     * @var string
     */
    protected $mode;
    /**
     * The ids of the persons whose access and history this response includes.
     *
     * @return list<string>
     */
    public function getIncludedPersonIds(): array
    {
        return $this->includedPersonIds;
    }
    /**
     * The ids of the persons whose access and history this response includes.
     *
     * @param list<string> $includedPersonIds
     *
     * @return self
     */
    public function setIncludedPersonIds(array $includedPersonIds): self
    {
        $this->initialized['includedPersonIds'] = true;
        $this->includedPersonIds = $includedPersonIds;
        return $this;
    }
    /**
     * The id of the transfer still moving another person's purchases to this one; null when none is running.
     *
     * @return string|null
     */
    public function getMigrationJobId(): ?string
    {
        return $this->migrationJobId;
    }
    /**
     * The id of the transfer still moving another person's purchases to this one; null when none is running.
     *
     * @param string|null $migrationJobId
     *
     * @return self
     */
    public function setMigrationJobId(?string $migrationJobId): self
    {
        $this->initialized['migrationJobId'] = true;
        $this->migrationJobId = $migrationJobId;
        return $this;
    }
    /**
     * `persisted` when the response shows only this person; `temporary_pending_transfer` when an identify is still moving the anonymous person's purchases over, and both are shown together until it finishes.
     *
     * @return string
     */
    public function getMode(): string
    {
        return $this->mode;
    }
    /**
     * `persisted` when the response shows only this person; `temporary_pending_transfer` when an identify is still moving the anonymous person's purchases over, and both are shown together until it finishes.
     *
     * @param string $mode
     *
     * @return self
     */
    public function setMode(string $mode): self
    {
        $this->initialized['mode'] = true;
        $this->mode = $mode;
        return $this;
    }
}
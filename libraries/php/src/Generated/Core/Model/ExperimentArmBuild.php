<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentArmBuild
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
     * The build the arm keeps in this environment whatever is deployed to the paywall, `pw_build_...`: the one deployed when the experiment started, or the one the arm was deployed to since (`experiments.deployVariant`). Null while the arm follows the paywall's deployed build: in a draft, in an experiment started before arms kept their build, and for a build made before builds were recorded.
     *
     * @var string|null
     */
    protected $keptBuildId;
    /**
     * The number of `keptBuildId`'s build; null when the arm keeps none.
     *
     * @var int|null
     */
    protected $keptBuildNumber;
    /**
     * The number of the paywall's build deployed to this environment now, which the paywall shows everywhere outside the experiment; null when none is.
     *
     * @var int|null
     */
    protected $deployedBuildNumber;
    /**
     * For the arm a concluded experiment rolled out at the location, the number of the build the location went on to show in this environment; null otherwise.
     *
     * @var int|null
     */
    protected $concludedBuildNumber;
    /**
     * The build the arm keeps in this environment whatever is deployed to the paywall, `pw_build_...`: the one deployed when the experiment started, or the one the arm was deployed to since (`experiments.deployVariant`). Null while the arm follows the paywall's deployed build: in a draft, in an experiment started before arms kept their build, and for a build made before builds were recorded.
     *
     * @return string|null
     */
    public function getKeptBuildId(): ?string
    {
        return $this->keptBuildId;
    }
    /**
     * The build the arm keeps in this environment whatever is deployed to the paywall, `pw_build_...`: the one deployed when the experiment started, or the one the arm was deployed to since (`experiments.deployVariant`). Null while the arm follows the paywall's deployed build: in a draft, in an experiment started before arms kept their build, and for a build made before builds were recorded.
     *
     * @param string|null $keptBuildId
     *
     * @return self
     */
    public function setKeptBuildId(?string $keptBuildId): self
    {
        $this->initialized['keptBuildId'] = true;
        $this->keptBuildId = $keptBuildId;
        return $this;
    }
    /**
     * The number of `keptBuildId`'s build; null when the arm keeps none.
     *
     * @return int|null
     */
    public function getKeptBuildNumber(): ?int
    {
        return $this->keptBuildNumber;
    }
    /**
     * The number of `keptBuildId`'s build; null when the arm keeps none.
     *
     * @param int|null $keptBuildNumber
     *
     * @return self
     */
    public function setKeptBuildNumber(?int $keptBuildNumber): self
    {
        $this->initialized['keptBuildNumber'] = true;
        $this->keptBuildNumber = $keptBuildNumber;
        return $this;
    }
    /**
     * The number of the paywall's build deployed to this environment now, which the paywall shows everywhere outside the experiment; null when none is.
     *
     * @return int|null
     */
    public function getDeployedBuildNumber(): ?int
    {
        return $this->deployedBuildNumber;
    }
    /**
     * The number of the paywall's build deployed to this environment now, which the paywall shows everywhere outside the experiment; null when none is.
     *
     * @param int|null $deployedBuildNumber
     *
     * @return self
     */
    public function setDeployedBuildNumber(?int $deployedBuildNumber): self
    {
        $this->initialized['deployedBuildNumber'] = true;
        $this->deployedBuildNumber = $deployedBuildNumber;
        return $this;
    }
    /**
     * For the arm a concluded experiment rolled out at the location, the number of the build the location went on to show in this environment; null otherwise.
     *
     * @return int|null
     */
    public function getConcludedBuildNumber(): ?int
    {
        return $this->concludedBuildNumber;
    }
    /**
     * For the arm a concluded experiment rolled out at the location, the number of the build the location went on to show in this environment; null otherwise.
     *
     * @param int|null $concludedBuildNumber
     *
     * @return self
     */
    public function setConcludedBuildNumber(?int $concludedBuildNumber): self
    {
        $this->initialized['concludedBuildNumber'] = true;
        $this->concludedBuildNumber = $concludedBuildNumber;
        return $this;
    }
}
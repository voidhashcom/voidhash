<?php

namespace Voidhash\Generated\Core\Model;

class ConcludeExperimentBodyJsonEncoding
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
     * The arm to promote, `exp_var_...`; omitted, the control arm is promoted.
     *
     * @var string|null
     */
    protected $winningVariantId;
    /**
     * Which build each location shows once the experiment concludes. `live_build`, the default, shows the paywall's deployed build, as everywhere else the paywall is shown, deploying nothing. `tested_build` first deploys the build the winning arm ran to each environment where it is not the deployed one, which changes the paywall everywhere it is shown there and needs the permission to deploy paywalls (`project:paywalls:publish`), then concludes.
     *
     * @var string
     */
    protected $rollOut;
    /**
     * The arm to promote, `exp_var_...`; omitted, the control arm is promoted.
     *
     * @return string|null
     */
    public function getWinningVariantId(): ?string
    {
        return $this->winningVariantId;
    }
    /**
     * The arm to promote, `exp_var_...`; omitted, the control arm is promoted.
     *
     * @param string|null $winningVariantId
     *
     * @return self
     */
    public function setWinningVariantId(?string $winningVariantId): self
    {
        $this->initialized['winningVariantId'] = true;
        $this->winningVariantId = $winningVariantId;
        return $this;
    }
    /**
     * Which build each location shows once the experiment concludes. `live_build`, the default, shows the paywall's deployed build, as everywhere else the paywall is shown, deploying nothing. `tested_build` first deploys the build the winning arm ran to each environment where it is not the deployed one, which changes the paywall everywhere it is shown there and needs the permission to deploy paywalls (`project:paywalls:publish`), then concludes.
     *
     * @return string
     */
    public function getRollOut(): string
    {
        return $this->rollOut;
    }
    /**
     * Which build each location shows once the experiment concludes. `live_build`, the default, shows the paywall's deployed build, as everywhere else the paywall is shown, deploying nothing. `tested_build` first deploys the build the winning arm ran to each environment where it is not the deployed one, which changes the paywall everywhere it is shown there and needs the permission to deploy paywalls (`project:paywalls:publish`), then concludes.
     *
     * @param string $rollOut
     *
     * @return self
     */
    public function setRollOut(string $rollOut): self
    {
        $this->initialized['rollOut'] = true;
        $this->rollOut = $rollOut;
        return $this;
    }
}
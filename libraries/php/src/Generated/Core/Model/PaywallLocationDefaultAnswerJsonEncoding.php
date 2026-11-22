<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationDefaultAnswerJsonEncoding
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
     * @var SdkResolvedPaywallJsonEncoding
     */
    protected $answer;
    /**
     * The revision of the location's interface the answer was taken for.
     *
     * @var int
     */
    protected $interfaceRevision;
    /**
     * The A/B test at the location, running or paused, whose control arm the answer is; null when no test chose it.
     *
     * @var PaywallLocationDefaultAnswerJsonEncodingExperiment|null
     */
    protected $experiment;
    /**
     * The build the location shows, when it is withdrawn: the answer then names the earlier build apps are served instead. Null when the build the location shows is not withdrawn.
     *
     * @var PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild|null
     */
    protected $withdrawnBuild;
    /**
     * What the app's SDK needs to show the answer's build.
     *
     * @var PaywallLocationDefaultAnswerJsonEncodingRequirements
     */
    protected $requirements;
    /**
     * @return SdkResolvedPaywallJsonEncoding
     */
    public function getAnswer(): SdkResolvedPaywallJsonEncoding
    {
        return $this->answer;
    }
    /**
     * @param SdkResolvedPaywallJsonEncoding $answer
     *
     * @return self
     */
    public function setAnswer(SdkResolvedPaywallJsonEncoding $answer): self
    {
        $this->initialized['answer'] = true;
        $this->answer = $answer;
        return $this;
    }
    /**
     * The revision of the location's interface the answer was taken for.
     *
     * @return int
     */
    public function getInterfaceRevision(): int
    {
        return $this->interfaceRevision;
    }
    /**
     * The revision of the location's interface the answer was taken for.
     *
     * @param int $interfaceRevision
     *
     * @return self
     */
    public function setInterfaceRevision(int $interfaceRevision): self
    {
        $this->initialized['interfaceRevision'] = true;
        $this->interfaceRevision = $interfaceRevision;
        return $this;
    }
    /**
     * The A/B test at the location, running or paused, whose control arm the answer is; null when no test chose it.
     *
     * @return PaywallLocationDefaultAnswerJsonEncodingExperiment|null
     */
    public function getExperiment(): ?PaywallLocationDefaultAnswerJsonEncodingExperiment
    {
        return $this->experiment;
    }
    /**
     * The A/B test at the location, running or paused, whose control arm the answer is; null when no test chose it.
     *
     * @param PaywallLocationDefaultAnswerJsonEncodingExperiment|null $experiment
     *
     * @return self
     */
    public function setExperiment(?PaywallLocationDefaultAnswerJsonEncodingExperiment $experiment): self
    {
        $this->initialized['experiment'] = true;
        $this->experiment = $experiment;
        return $this;
    }
    /**
     * The build the location shows, when it is withdrawn: the answer then names the earlier build apps are served instead. Null when the build the location shows is not withdrawn.
     *
     * @return PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild|null
     */
    public function getWithdrawnBuild(): ?PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild
    {
        return $this->withdrawnBuild;
    }
    /**
     * The build the location shows, when it is withdrawn: the answer then names the earlier build apps are served instead. Null when the build the location shows is not withdrawn.
     *
     * @param PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild|null $withdrawnBuild
     *
     * @return self
     */
    public function setWithdrawnBuild(?PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild $withdrawnBuild): self
    {
        $this->initialized['withdrawnBuild'] = true;
        $this->withdrawnBuild = $withdrawnBuild;
        return $this;
    }
    /**
     * What the app's SDK needs to show the answer's build.
     *
     * @return PaywallLocationDefaultAnswerJsonEncodingRequirements
     */
    public function getRequirements(): PaywallLocationDefaultAnswerJsonEncodingRequirements
    {
        return $this->requirements;
    }
    /**
     * What the app's SDK needs to show the answer's build.
     *
     * @param PaywallLocationDefaultAnswerJsonEncodingRequirements $requirements
     *
     * @return self
     */
    public function setRequirements(PaywallLocationDefaultAnswerJsonEncodingRequirements $requirements): self
    {
        $this->initialized['requirements'] = true;
        $this->requirements = $requirements;
        return $this;
    }
}
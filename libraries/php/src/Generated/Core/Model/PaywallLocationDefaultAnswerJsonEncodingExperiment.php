<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationDefaultAnswerJsonEncodingExperiment
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
     * The A/B test's id, `exp_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The A/B test's name.
     *
     * @var string
     */
    protected $name;
    /**
     * Where the experiment is in its life: a `draft` assigns no traffic, a `running` one splits it between the arms, a `paused` one shows every end user the control arm, and a `concluded` one has promoted a winner and never runs again.
     *
     * @var string
     */
    protected $status;
    /**
     * The A/B test's id, `exp_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The A/B test's id, `exp_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The A/B test's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The A/B test's name.
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
     * Where the experiment is in its life: a `draft` assigns no traffic, a `running` one splits it between the arms, a `paused` one shows every end user the control arm, and a `concluded` one has promoted a winner and never runs again.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where the experiment is in its life: a `draft` assigns no traffic, a `running` one splits it between the arms, a `paused` one shows every end user the control arm, and a `concluded` one has promoted a winner and never runs again.
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
}
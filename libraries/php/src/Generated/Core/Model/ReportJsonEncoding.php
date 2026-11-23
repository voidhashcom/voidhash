<?php

namespace Voidhash\Generated\Core\Model;

class ReportJsonEncoding
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
     * The report's id, which is its file's id in Files.
     *
     * @var string
     */
    protected $id;
    /**
     * The report's name, its file's name in Files.
     *
     * @var string
     */
    protected $name;
    /**
     * Its insights, in the order they were added, each with where the body shows it.
     *
     * @var list<ReportInsightJsonEncoding>
     */
    protected $insights;
    /**
     * The report's body as GitHub-flavored Markdown, with two tokens for its analytics. `<#insight:ID>` alone in a paragraph is the chart or table of the report's insight `ID`. `<#value:ID>` inside text is a live number from insight `ID`, and `<#value:ID:SHOW>` says which: `value`, `previous`, `change`, `difference`, `direction` (`value` unless given). Every `ID` is one of the report's `insights`. A report is live and has no controls: each number and chart shows the period its insight runs over, unless its token ends in `@RANGE`, a period of its own: a named range such as `today`, `last_30d` or `last_year`, which moves with today, or fixed days such as `2025-01-01..2025-12-31`, also written `2025`, `2025-10` or `2025-11-12` and read back as their days. So `Revenue was <#value:ID@2025> last year, compared to <#value:ID@today> today.` A token inside a code span or code block, or with an escaped character, stays text.
     *
     * @var string
     */
    protected $content;
    /**
     * The report's id, which is its file's id in Files.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The report's id, which is its file's id in Files.
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
     * The report's name, its file's name in Files.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The report's name, its file's name in Files.
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
     * Its insights, in the order they were added, each with where the body shows it.
     *
     * @return list<ReportInsightJsonEncoding>
     */
    public function getInsights(): array
    {
        return $this->insights;
    }
    /**
     * Its insights, in the order they were added, each with where the body shows it.
     *
     * @param list<ReportInsightJsonEncoding> $insights
     *
     * @return self
     */
    public function setInsights(array $insights): self
    {
        $this->initialized['insights'] = true;
        $this->insights = $insights;
        return $this;
    }
    /**
     * The report's body as GitHub-flavored Markdown, with two tokens for its analytics. `<#insight:ID>` alone in a paragraph is the chart or table of the report's insight `ID`. `<#value:ID>` inside text is a live number from insight `ID`, and `<#value:ID:SHOW>` says which: `value`, `previous`, `change`, `difference`, `direction` (`value` unless given). Every `ID` is one of the report's `insights`. A report is live and has no controls: each number and chart shows the period its insight runs over, unless its token ends in `@RANGE`, a period of its own: a named range such as `today`, `last_30d` or `last_year`, which moves with today, or fixed days such as `2025-01-01..2025-12-31`, also written `2025`, `2025-10` or `2025-11-12` and read back as their days. So `Revenue was <#value:ID@2025> last year, compared to <#value:ID@today> today.` A token inside a code span or code block, or with an escaped character, stays text.
     *
     * @return string
     */
    public function getContent(): string
    {
        return $this->content;
    }
    /**
     * The report's body as GitHub-flavored Markdown, with two tokens for its analytics. `<#insight:ID>` alone in a paragraph is the chart or table of the report's insight `ID`. `<#value:ID>` inside text is a live number from insight `ID`, and `<#value:ID:SHOW>` says which: `value`, `previous`, `change`, `difference`, `direction` (`value` unless given). Every `ID` is one of the report's `insights`. A report is live and has no controls: each number and chart shows the period its insight runs over, unless its token ends in `@RANGE`, a period of its own: a named range such as `today`, `last_30d` or `last_year`, which moves with today, or fixed days such as `2025-01-01..2025-12-31`, also written `2025`, `2025-10` or `2025-11-12` and read back as their days. So `Revenue was <#value:ID@2025> last year, compared to <#value:ID@today> today.` A token inside a code span or code block, or with an escaped character, stays text.
     *
     * @param string $content
     *
     * @return self
     */
    public function setContent(string $content): self
    {
        $this->initialized['content'] = true;
        $this->content = $content;
        return $this;
    }
}
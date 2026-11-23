<?php

namespace Voidhash\Generated\Core\Model;

class UpdateReportBodyJsonEncoding
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
     * Replaces the whole body. The report's body as GitHub-flavored Markdown, with two tokens for its analytics. `<#insight:ID>` alone in a paragraph is the chart or table of the report's insight `ID`. `<#value:ID>` inside text is a live number from insight `ID`, and `<#value:ID:SHOW>` says which: `value`, `previous`, `change`, `difference`, `direction` (`value` unless given). Every `ID` is one of the report's `insights`. A report is live and has no controls: each number and chart shows the period its insight runs over, unless its token ends in `@RANGE`, a period of its own: a named range such as `today`, `last_30d` or `last_year`, which moves with today, or fixed days such as `2025-01-01..2025-12-31`, also written `2025`, `2025-10` or `2025-11-12` and read back as their days. So `Revenue was <#value:ID@2025> last year, compared to <#value:ID@today> today.` A token inside a code span or code block, or with an escaped character, stays text. Not with `contentEdits`.
     *
     * @var string|null
     */
    protected $content;
    /**
     * Changes parts of the body instead, up to 100 edits applied in order to its Markdown; all or none apply. Not with `content`.
     *
     * @var list<ReportContentEdit>|null
     */
    protected $contentEdits;
    /**
     * Replaces the whole body. The report's body as GitHub-flavored Markdown, with two tokens for its analytics. `<#insight:ID>` alone in a paragraph is the chart or table of the report's insight `ID`. `<#value:ID>` inside text is a live number from insight `ID`, and `<#value:ID:SHOW>` says which: `value`, `previous`, `change`, `difference`, `direction` (`value` unless given). Every `ID` is one of the report's `insights`. A report is live and has no controls: each number and chart shows the period its insight runs over, unless its token ends in `@RANGE`, a period of its own: a named range such as `today`, `last_30d` or `last_year`, which moves with today, or fixed days such as `2025-01-01..2025-12-31`, also written `2025`, `2025-10` or `2025-11-12` and read back as their days. So `Revenue was <#value:ID@2025> last year, compared to <#value:ID@today> today.` A token inside a code span or code block, or with an escaped character, stays text. Not with `contentEdits`.
     *
     * @return string|null
     */
    public function getContent(): ?string
    {
        return $this->content;
    }
    /**
     * Replaces the whole body. The report's body as GitHub-flavored Markdown, with two tokens for its analytics. `<#insight:ID>` alone in a paragraph is the chart or table of the report's insight `ID`. `<#value:ID>` inside text is a live number from insight `ID`, and `<#value:ID:SHOW>` says which: `value`, `previous`, `change`, `difference`, `direction` (`value` unless given). Every `ID` is one of the report's `insights`. A report is live and has no controls: each number and chart shows the period its insight runs over, unless its token ends in `@RANGE`, a period of its own: a named range such as `today`, `last_30d` or `last_year`, which moves with today, or fixed days such as `2025-01-01..2025-12-31`, also written `2025`, `2025-10` or `2025-11-12` and read back as their days. So `Revenue was <#value:ID@2025> last year, compared to <#value:ID@today> today.` A token inside a code span or code block, or with an escaped character, stays text. Not with `contentEdits`.
     *
     * @param string|null $content
     *
     * @return self
     */
    public function setContent(?string $content): self
    {
        $this->initialized['content'] = true;
        $this->content = $content;
        return $this;
    }
    /**
     * Changes parts of the body instead, up to 100 edits applied in order to its Markdown; all or none apply. Not with `content`.
     *
     * @return list<ReportContentEdit>|null
     */
    public function getContentEdits(): ?array
    {
        return $this->contentEdits;
    }
    /**
     * Changes parts of the body instead, up to 100 edits applied in order to its Markdown; all or none apply. Not with `content`.
     *
     * @param list<ReportContentEdit>|null $contentEdits
     *
     * @return self
     */
    public function setContentEdits(?array $contentEdits): self
    {
        $this->initialized['contentEdits'] = true;
        $this->contentEdits = $contentEdits;
        return $this;
    }
}
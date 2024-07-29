const arrowKeyCodes = [
    38, // Arrow up.
    40  // Arrow down.
];

const selectionKeyCodes = [
    13, // Enter.
    9 // Tab.
];

const addAutoCompleteTo = (elem, handler) =>
{
    const ac_wrapper = $('<div class="autocomplete"></div');
    $(elem).parent().append(ac_wrapper);
    ac_wrapper.append(elem);
    const ac_items = $('<div class="autocomplete-items"></div>').appendTo(ac_wrapper);

    $(elem).on("input focus", handler);

    $(elem).on("blur", function () {
        if (ac_items.find("span").length === 1)
        {
            ac_items.find("span").trigger("click");
        }

        ac_items.hide();
    });

    ac_items.on("mouseenter", "span", function () {
        ac_items.find("span").mouseleave();

        $(this).css("background-color", "#F0F0F0");
        $(this).css("cursor", "pointer");
    });

    ac_items.on("mouseleave", "span", function () {
        $(this).css("background-color", "#FFF");
    });

    ac_items.on("mousedown", "span", function (evt) {
        evt.preventDefault();
    });

    ac_items.on("click blur", "span", function () {
        $(elem).val($(this).text().replace("*", ""));
        $(elem).trigger("input");
        ac_items.empty();
        ac_items.hide();
    });

    $(document).on("keydown", function (evt)
    {
        const ac_items_spans = ac_items.find("span");
        const highlighted = ac_items_spans.get().findIndex(function (span)
        {
            const bgColor = $(span).css("background-color").toLowerCase();
            return bgColor !== "rgb(255, 255, 255)" && bgColor !== "#fff";
        });

        if (arrowKeyCodes.includes(evt.keyCode))
        {
            if (elem.is(":focus"))
            {
                const step = evt.keyCode === 40 ? 1 : -1;
                let nextHighlight = highlighted + step;
    
                if (nextHighlight >= ac_items_spans.length)
                {
                    nextHighlight = 0;
                }

                if (nextHighlight < 0)
                {
                    nextHighlight = ac_items_spans.length - 1;
                }

                if (highlighted < 0)
                {
                    ac_items.find("span:eq(" + nextHighlight + ")").mouseenter();
                }
                else
                {
                    ac_items_spans.mouseleave();
                    ac_items.find("span:eq(" + nextHighlight + ")").mouseenter();
                }
            }
        }
        else if (selectionKeyCodes.includes(evt.keyCode))
        {
            if (highlighted >= 0)
            {
                evt.preventDefault();
                ac_items.find("span:eq(" + highlighted + ")").click();
            }
        }
    });
};

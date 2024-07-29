$(async () =>
{
    $(document).on("click", ".modal-close", function ()
    {
        $("#modal-pic-box").hide();
    });

    $("#spms").on("click", ".modal-opener", function (event)
    {
        event.stopPropagation();

        const caption = $(this).attr("alt");
        const src = $(this).attr("src").replace("/thumbnails/", "/images/");

        $("#modal-pic-box > .modal-content").attr("src", src);
        $("#modal-pic-box > #modal-caption").empty();
        $("#modal-pic-box > #modal-caption").append(`<h1>${caption}</h1>`);
        $("#modal-pic-box").show();
    });
});


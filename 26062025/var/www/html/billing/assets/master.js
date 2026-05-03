/*     $(function($) {
         // this bit needs to be loaded on every page where an ajax POST may happen
         $.ajaxSetup({
             data: {
                 _ctoken: Cookies.get('_ccookie')
             }
         });
        
     });*/
$(function() {
    // Table setup
    // ------------------------------
    // Setting datatable defaults
    $.extend($.fn.dataTable.defaults, {
        autoWidth: false,
        responsive: true,
        columnDefs: [{
            // orderable: false,
            width: '230px',
            targets: [-1],
            order:'desc'
        }],
        dom: '<"datatable-header"fl><"datatable-scroll-wrap"t><"datatable-footer"ip>',
        language: {
            search: '<span>Search:</span> _INPUT_',
            lengthMenu: '<span>Show:</span> _MENU_',
            paginate: {
                'first': 'First',
                'last': 'Last',
                'next': '&rarr;',
                'previous': '&larr;'
            }
        },
         order: [], 
        drawCallback: function() {
            $(this).find('tbody tr').slice(-3).find('.dropdown, .btn-group').addClass('dropup');
        },
        preDrawCallback: function() {
            $(this).find('tbody tr').slice(-3).find('.dropdown, .btn-group').removeClass('dropup');
        }
    });
    // Basic responsive configuration
    $('.datatable-responsive').DataTable();
    // External table additions
    var ajx_path = $("#ajax_table").attr("data-url");
    var oTable = $("#ajax_table").DataTable({
      processing: true, //Feature control the processing indicator.
      serverSide: true, //Feature control DataTables' server-side processing mode.
      order: [], //Initial no order.
      pageLength: 10,
      stateSave: true,
      deferRender: true,
      language: {
        processing: '<i class="icon-spinner3 spinner" style="font-size:36px;"></i>',
        
      },
     
      // Load data for the table's content from an Ajax source
      ajax: {
        url: ajx_path,
        type: "POST",
      },
      //Set column definition initialisation properties.
      columnDefs: [
        {
          targets: [-1], //button column / actions column
          searchable: false, //set not orderable
          orderable: false, //set not orderable
          class: "text-center",
        },
        {
          targets: [1, 4, 5], //button column / actions column
          class: "text-center",
        },
      ],
      /*"fnDrawCallback": function(oSettings) {
              $.ajaxSetup({
                  data: {
                      _ctoken: Cookies.get('_ccookie')
                  }
              });
               $('[data-popup]').tooltip();
          }*/
    });
  
    var userSource1 = $("#users_table").attr("data-url");
    $("#users_table").DataTable({
        processing: true, // Feature control the processing indicator.
        serverSide: true, // Feature control DataTables' server-side processing mode.
        order: [], // Initial no order.
        pageLength: 10,
        stateSave: true,
        deferRender: true,
        dom: '<"datatable-header"fl><"datatable-scroll-wrap"t><"datatable-footer"ip>r',
        language: {
            processing: '<i class="icon-spinner3 spinner" style="font-size:36px;"></i>',
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            infoFiltered: "",
        },
        ajax: {
            url: userSource1,
            type: "POST",
            data: function(d) {
                d[csrfName] = csrfHash; // Add CSRF Token properly here
            },
            dataSrc: function(json) {
                csrfHash = json.csrfHash; // Update CSRF Hash after response
                $("input[type='search']").val();
                return json.data; // Return the actual data for the table
            }
        },
       
      //Set column definition initialisation properties.
      columnDefs: [
        {
          targets: [0, 4], //button column / actions column
          searchable: false, //set not orderable
          orderable: false, //set not orderable
          //width: "300px",
          class: "text-center",
        },
        {
            targets: [1,2,4,5,6], //button column / actions column
            class: "text-center",
          }
      ],
      /*"fnDrawCallback": function(oSettings) {
              $.ajaxSetup({
                  data: {
                      _ctoken: Cookies.get('_ccookie')
                  }
              });
               $('[data-popup]').tooltip();
          }*/
    });
    var userSource2 = $("#reseller_table").attr("data-url");
    $("#reseller_table").DataTable({
        processing: true, // Feature control the processing indicator.
        serverSide: true, // Feature control DataTables' server-side processing mode.
        order: [], // Initial no order.
        pageLength: 10,
        stateSave: true,
        deferRender: true,
        dom: '<"datatable-header"fl><"datatable-scroll-wrap"t><"datatable-footer"ip>r',
        language: {
            processing: '<i class="icon-spinner3 spinner" style="font-size:36px;"></i>',
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            infoFiltered: "",
        },
        ajax: {
            url: userSource2,
            type: "POST",
            data: function(d) {
                d[csrfName] = csrfHash; // Add CSRF Token properly here
            },
            dataSrc: function(json) {
                csrfHash = json.csrfHash; // Update CSRF Hash after response
                return json.data; // Return the actual data for the table
            }
        },
        columnDefs: [
            {
              targets: [0, 3], //button column / actions column
              searchable: false, //set not orderable
              orderable: false, //set not orderable
              //width: "300px",
              class: "text-center",
            }
          ],
      //Set column definition initialisation properties.
    //   columnDefs: [
    //     {
    //       targets: [-1, -2], //button column / actions column
    //       searchable: false, //set not orderable
    //       orderable: false, //set not orderable
    //       //width: "300px",
    //       class: "text-center",
    //     },
    //     {
    //       targets: [5, 6, 7], //button column / actions column
    //       class: "text-center",
    //     },
    //     {
    //       targets: [0], //button column / actions column
    //       class: "text-center",
    //       searchable: false,
    //       orderable: false,
    //     },
    //   ],
      /*"fnDrawCallback": function(oSettings) {
              $.ajaxSetup({
                  data: {
                      _ctoken: Cookies.get('_ccookie')
                  }
              });
               $('[data-popup]').tooltip();
          }*/
    });
    var userSource3 = $("#manager_table").attr("data-url");
    $("#manager_table").DataTable({
        processing: true, // Feature control the processing indicator.
        serverSide: true, // Feature control DataTables' server-side processing mode.
        order: [], // Initial no order.
        pageLength: 10,
        stateSave: true,
        deferRender: true,
        dom: '<"datatable-header"fl><"datatable-scroll-wrap"t><"datatable-footer"ip>r',
        language: {
            processing: '<i class="icon-spinner3 spinner" style="font-size:36px;"></i>',
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            infoFiltered: "",
        },
        ajax: {
            url: userSource3,
            type: "POST",
            data: function(d) {
                d[csrfName] = csrfHash; // Add CSRF Token properly here
            },
            dataSrc: function(json) {
                csrfHash = json.csrfHash; // Update CSRF Hash after response
                console.log(json.data.length);
                
                return json.data; // Return the actual data for the table
            }
        },
        columnDefs: [
            {
              targets: [0, 4, 5, 11], //button column / actions column
              searchable: false, //set not orderable
              orderable: false, //set not orderable
              //width: "300px",
              class: "text-center",
            }
          ],
    });
    
    var userSource5 = $("#admin_user_table").attr("data-url");
    $("#admin_user_table").DataTable({
        processing: true, // Feature control the processing indicator.
        serverSide: true, // Feature control DataTables' server-side processing mode.
        order: [], // Initial no order.
        pageLength: 10,
        stateSave: true,
        deferRender: true,
        dom: '<"datatable-header"fl><"datatable-scroll-wrap"t><"datatable-footer"ip>r',
        language: {
            processing: '<i class="icon-spinner3 spinner" style="font-size:36px;"></i>',
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            infoFiltered: "",
        },
        ajax: {
            url: userSource5,
            type: "POST",
            data: function(d) {
                d[csrfName] = csrfHash; // Add CSRF Token properly here
            },
            dataSrc: function(json) {
                csrfHash = json.csrfHash; // Update CSRF Hash after response
                console.log(json.data.length);
                return json.data; // Return the actual data for the table
            }
        },
        columnDefs: [
            {
              targets: [0, 1, 2, 3, 6,10], //button column / actions column
              searchable: false, //set not orderable
              orderable: false, //set not orderable
              //width: "300px",
              class: "text-center",
            }
          ],
    });
    // usersTable.on('xhr.dt', function(e, settings, json, xhr){
    //     $(".total_users").text("ALL ("+ json.recordsFiltered+")")
    //     // Your custom function after data received
    // });
    // ------------------------------
    // Add placeholder to the datatable filter option
    $('.dataTables_filter input[type=search]').attr('placeholder', 'Type to search...');
    $('.dataTables_filter').attr('style','float:right;')
    $('.dataTables_length').attr('style','float:left;')
    var actiontools = $('.actiontools').html();
    $('.dataTables_length').after('<div class="action_btns btn-group">'+actiontools+'</div>');
    // Enable Select2 select for the length option
     $('select').select2();
    $('.dataTables_length select').select2({
        minimumResultsForSearch: Infinity,
        width: 'auto'
    });
    $(".styled, .multiselect-container input").uniform({
        radioClass: 'choice'
    });
   
    /*Input MASK for MAC Address*/
    $('#mac_mask').inputmask({
        mask: 'hh:hh:hh:hh:hh:hh',
        definitions: {
            h: '[A-Fa-f0-9]',
            n: '[0-9]',
             v: 'A'
        }
    });
   
});
/*Resellers and dealers drop down*/
function getDealer() {
    var reseller = $("#reseller_drop").val();
    // alert(reseller);
    $.ajax({
        type: "POST",
        url: SiteURL + "/users/get_dealer_dropdown",
        data: 'reseller=' + reseller,
        success: function(data) {
            $("#dealer-list").html(data);
            $('select').select2();
        }
    });
}
/*End Resellers and dealers drop down*/
function package_selecter() {
    var packs = $('#tariff_custom').find("option:selected").text();
    // alert(packs);
    if (packs == "CUSTOM PACKAGE") {
        $('#Custom_Packages').show();
    } else {
        $('#Custom_Packages').hide();
    }
}
/*$("#select_all").click(function() { //"select all" change
    // $('.checkbox_pack').attr('checked','checked')
    $('.checkbox_pack').prop('checked', true);
    //$(".checkbox_pack").prop('checked', $(this).prop("checked")); //change all ".checkbox" checked status
});*/
function uncheck_all() {
    $('.checkbox_pack').prop('checked', false);
}

function check_all() {
    $('.checkbox_pack').prop('checked', true);
}
/*$("#deselect_all").click(function() { //"select all" change
    // $(".checkbox_pack").prop('checked', $(this).prop("checked",false)); //change all ".checkbox" checked status
    // $('.checkbox_pack').removeAttr('checked');
    
});*/
function show_custom_selection(type) {
    if (type == 'All') {
        $('#cust_sel > select').prop('disabled', true);
    } else {
        $('#cust_sel > select').prop('disabled', false);
        // $('#cust_sel').show();
    }
}
$("#goback").click(function() {
    /* Act on the event */
    history.back();
});

function load_table(path) {
    var oTable = $('#big_table').DataTable({
        "processing": true, //Feature control the processing indicator.
        "serverSide": true, //Feature control DataTables' server-side processing mode.
        "order": [], //Initial no order.
        "pageLength": 20,
        // Load data for the table's content from an Ajax source
        "ajax": {
            "url": path,
            "type": "POST",
        },
        //Set column definition initialisation properties.
        "columnDefs": [{
            "targets": [-1], //button column / actions column
            "searchable": false, //set not orderable
            "orderable": false, //set not orderable
        }, ],
        "fnDrawCallback": function(oSettings) {
            $.ajaxSetup({
                data: {
                    _ctoken: Cookies.get('_ccookie')
                }
            });
            $('.tooltips').tooltip({
                trigger: 'hover',
                html: true
            });
        }
    });
}

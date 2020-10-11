'use strict';

const {Gtk, Gio, GLib, GObject} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const GoogleClient = Me.imports.googleClient.GoogleClient;


var StocksTab = class StocksTab {

  constructor(label, columnNames, columnTypes) {
    this._label = new Gtk.Label({
      label: label
    });

    this._create_scroll_tree(columnNames, columnTypes);
    this._create_grid();
  }

  _create_scroll_tree(columnNames, columnTypes) {
    const ctx = this;
    ctx._listStore = new Gtk.ListStore();
    ctx._listStore.set_column_types(columnTypes);
    ctx._treeView = new Gtk.TreeView({
      expand: true,
      model: ctx._listStore
    });

    for (let i=0; i < columnNames.length; i++) {
      let columnName = columnNames[i];
      let column = new Gtk.TreeViewColumn({
        title: columnName,
        expand: true,
      });

      let renderer = new Gtk.CellRendererText();
      column.pack_start(renderer, true);
      column.add_attribute(renderer, "text", i);

      ctx._treeView.append_column(column);
    }

    ctx._scrollTree = new Gtk.ScrolledWindow({
      propagate_natural_height: true,
      propagate_natural_width: true
    });
    ctx._scrollTree.add(ctx._treeView);
    ctx._treeView.connect("size-allocate", _ => {
      const adj = ctx._scrollTree.get_vadjustment();
      adj.set_value(adj.get_upper());
    });
  }

  _create_grid() {
    this._grid = new Gtk.Grid({
      visible: true,
      can_focus: false,
      hexpand: true,
      vexpand: true,
      border_width: 10,
      row_spacing: 5,
      column_spacing: 5
    });

    this._btnBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL
    });

    this._grid.attach(this._scrollTree, 0, 0, 1, 1);
    this._grid.attach(this._btnBox, 0, 1, 1, 1);
  }

  get_label() {
    return this._label;
  }

  get_grid() {
    return this._grid;
  }

  add_row(values) {
    let columns = [];
    for (let i = 0; i < values.length; i++) {
      columns.push(i);
    }
    this._listStore.set(this._listStore.append(), columns, values);
  }

  add_btn(name, callback) {
    const btn = new Gtk.Button({
      label: name,
      valign: Gtk.Align.END
    });
    this._btnBox.add(btn);

    btn.connect("clicked", callback);
  }
}

const AddFinDialog = GObject.registerClass(
    class AddFinDialog extends Gtk.Dialog {
      _init(params) {
        this._on_ok = params.on_ok;
        delete params.on_ok;

        super._init(params);

        // Set google client
        this._client = new GoogleClient();
        this._cache = {};

        this.set_modal(true);
        this.set_size_request(400, 300);
        this._set_content_area();

        const ctx = this;
        this.add_button("Ok", 1).connect("clicked", () => {
          ctx._on_ok(ctx._cache[ctx._entry.get_buffer().get_text()]);
          ctx.close.bind(ctx)();
        });
        this.add_button("Cancel", 2).connect("clicked", this.close.bind(this));
      }

      _set_content_area() {
        const ctx = this;
        const contentArea = ctx.get_content_area();
        ctx._entry = new Gtk.Entry();
        contentArea.add(ctx._entry);

        let selectionStore = new Gtk.ListStore();
        selectionStore.set_column_types([GObject.TYPE_STRING]);
        selectionStore.set(selectionStore.append(), [0], ["INL - Intel Corp. @ FRA"]);

        ctx._comp = new Gtk.EntryCompletion({
          model: selectionStore,
        });
        ctx._comp.set_text_column(0);
        ctx._comp.set_match_func((a, b, c) => {
          return true;
        });

        ctx._entry.set_completion(ctx._comp);
        ctx._entry.connect("changed", ctx._on_changed.bind(ctx));
      }

      _on_changed() {
        const ctx = this;
        const prefix = ctx._entry.get_buffer().get_text();

        ctx._client.get_suggestions(
            prefix,
            (suggestions) => {
              let updatedSelectionStore = new Gtk.ListStore();
              updatedSelectionStore.set_column_types([GObject.TYPE_STRING]);

              if (suggestions.length > 0) {
                ctx._cache = {};
              }
              for (let suggestion of suggestions) {
                let displayText = suggestion['symbol'] + ' - ' + suggestion['name'] + ' @ ' + suggestion['exchange'];
                ctx._cache[displayText] = suggestion;
                updatedSelectionStore.set(updatedSelectionStore.append(), [0], [displayText]);
              }

              ctx._comp.set_model(updatedSelectionStore);
            }
        );
      }
    }
);

const PrefsWidget = GObject.registerClass(
  class PrefsWidget extends Gtk.Box {
    _init(params) {
      super._init(params);
      this.set_orientation(Gtk.Orientation.VERTICAL);

      // Set notebook with tabs
      const notebook = new Gtk.Notebook();

      const [stocksLabel, stocksTab] = this._create_stocks_tab();
      const [generalLabel, generalTab] = this._create_general_tab()
      this._load_schema();

      notebook.append_page(stocksTab, stocksLabel);
      notebook.append_page(generalTab, generalLabel);

      this.add(notebook);
    }

    _load_schema() {
      const sss = Gio.SettingsSchemaSource;
      const schemaSource = sss.new_from_directory(
          Me.dir.get_child("schemas").get_path(),
          sss.get_default(),
          false
      );

      const schemaObj = schemaSource.lookup('org.gnome.shell.extensions.stocks-ticker', true);
      if (!schemaObj) {
        throw new Error('cannot find schema');
      }

      this.settings = new Gio.Settings({settings_schema: schemaObj});
      const financials = this.settings.get_value('financials');
      for (let i=0; i<financials.n_children(); i++) {
        let child = financials.get_child_value(i);
        let [name, _1] = child.lookup_value('name', null).get_string();
        let [symbol, _2] = child.lookup_value('symbol', null).get_string();
        let [exchange, _3] =  child.lookup_value('exchange', null).get_string();
        this._stocksTab.add_row([name, symbol, exchange]);
      }
    }

    _create_stocks_tab() {
      const ctx = this;

      ctx._stocksTab= new StocksTab(
          "Stocks",
          ["Symbol", "Full Name", "Exchange"],
          [
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING
          ]
      )

      ctx._stocksTab.add_btn("Add", () => {
        const dialog = new AddFinDialog({
          title: "Choose financial for tracking",
          on_ok: (financial) => {
            if (financial) {
              ctx._stocksTab.add_row([
                financial.symbol, financial.name, financial.exchange
              ]);

              const currentFinancials = ctx.settings.get_value('financials');
              let financialsArray = [];
              for (let i=0; i<currentFinancials.n_children(); i++) {
                financialsArray.push(currentFinancials.get_child_value(i));
              }

              // Construct new financial object
              const v = new GLib.Variant('a{ss}');
              const vDict = new GLib.VariantDict(v);
              for (let key in financial) {
                vDict.insert_value(key, GLib.Variant.new_string(financial[key]));
              }
              financialsArray.push(vDict.end());

              const variantType = new GLib.VariantType('a{ss}');
              const newFinancials = GLib.Variant.new_array(variantType, financialsArray);
              ctx.settings.set_value('financials', newFinancials);
            }
          }
        });
        dialog.show_all();
      });
      ctx._stocksTab.add_btn("Delete", () => {});

      return [ctx._stocksTab.get_label(), ctx._stocksTab.get_grid()];
    }

    _create_general_tab() {
      const label = new Gtk.Label({
        label: "General"
      });

      const dataRefreshLabel = new Gtk.Label({
        margin_left: 20,
        label: "Data refresh timeout[min]"
      });
      const dataRefreshSpinBtn = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        margin_right: 20
      });
      dataRefreshSpinBtn.set_sensitive(true);
      dataRefreshSpinBtn.set_range(1, 1440);
      dataRefreshSpinBtn.set_value(15);
      dataRefreshSpinBtn.set_increments(1, 2);
      dataRefreshSpinBtn.connect('value-changed', (w) => {
          log(w.get_value_as_int());
      });

      const grid = new Gtk.Grid({
        visible: true,
        can_focus: false,
        hexpand: true,
        vexpand: true,
        border_width: 10,
        row_spacing: 5,
        column_spacing: 5
      });
      grid.attach(dataRefreshLabel, 0, 0, 1, 1);
      grid.attach(dataRefreshSpinBtn, 1, 0, 1, 1);

      return [label, grid];
    }
  }
);

function init() {}

function buildPrefsWidget() {
  const widget = new PrefsWidget();
  widget.show_all();
  return widget;
}

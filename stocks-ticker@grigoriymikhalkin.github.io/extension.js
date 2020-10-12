'use strict';

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;

const {St, Clutter, GObject, GLib, Gio} = imports.gi;

const Me = ExtensionUtils.getCurrentExtension();
const GoogleClient = Me.imports.googleClient.GoogleClient;


let indicator, labelRefreshTimeout, dataRefreshTimeout;

const StocksTicker = GObject.registerClass(
  class StocksTicker extends PanelMenu.Button {
    _init() {
      super._init(0);

      this._refresh_cnt = 0;
      this._infoBox = this._create_info_box();
      const menuBtnBox = this._create_menu_btn_box();

      this._box = new St.BoxLayout({
        vertical: true,
      });
      this._box.add_child(this._infoBox);
      this._box.add_child(menuBtnBox);

      const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false
      });
      menuItem.add_child(this._box);
      this.menu.addMenuItem(menuItem);

      this._client = new GoogleClient();
      this._load_schema();
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

      const ctx = this;
      this.settings = new Gio.Settings({settings_schema: schemaObj});
      this.settings.connect('changed', (key) => {
        log(key);
        ctx._update_fids.bind(ctx)();
      });
      this._update_fids();
    }

    _update_fids() {
      Mainloop.source_remove(dataRefreshTimeout);

      const financials = this.settings.get_value('financials');
      let fids = [];

      for (let i=0; i < financials.n_children(); i++)
      {
        let [v, _] = financials.get_child_value(i).lookup_value('financialId', null).get_string();
        fids.push(v);
      }

      this._fids = fids;
      this._load_data();
    }

    _load_data() {
      const ctx = this;

      this._client.get_prices_update(
        ctx._fids,
        (priceUpdates) => {
          log("Data refreshed");
          ctx._data = priceUpdates;

          Mainloop.source_remove(labelRefreshTimeout);
          ctx._set_label();
          ctx._set_menu();

          // Set next call
          dataRefreshTimeout = Mainloop.timeout_add_seconds(30 * 60, ctx._load_data.bind(ctx));
        }
      );
    }

    _create_label(ind) {
      const priceUpdate = this._data[this._fids[ind]];
      const isChangeNegative = priceUpdate['change'] === 'NEGATIVE';

      let name = priceUpdate['name'] + '(' + priceUpdate['symbol'] + ':' + priceUpdate['exchange'] + ')'
      if (name.length > 20) {
        name = name.slice(0, 17) + '...';
      }
      return new St.Label({
        style_class: "status-text" + (isChangeNegative ? ' down-status-text' : ' up-status-text'),
        text: name + " - " + priceUpdate['price'] + priceUpdate['currency'] +
          (isChangeNegative ? '  ▼' : '  ▲') + priceUpdate['percent_change']
      });
    }

    _set_label() {
      if (this._label) {
        this.remove_child(this._label);
      }

      if (this._refresh_cnt === this._fids.length) {
        this._refresh_cnt = 0;
      }
      this._label = this._create_label(this._refresh_cnt);
      this.add_child(this._label);
      this._refresh_cnt++;

      // Set next call
      labelRefreshTimeout = Mainloop.timeout_add_seconds(10, this._set_label.bind(this));
    }

    _set_menu() {
      const infoBox = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.START
      });

      for (let i in this._fids) {
        let lb = this._create_label(i);
        infoBox.add_child(lb);
      }

      this._infoBox.add_actor(infoBox);

    }

    _create_info_box() {
      const scrollView = new St.ScrollView({
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
        overlay_scrollbars: true, x_expand: true, y_expand: true,
      });

      return scrollView;
    }

    _create_menu_btn_box() {
      const ctx = this;
      const menuBtnBox = new St.BoxLayout({});

      const settingsIcon = new St.Icon({
        icon_name: 'emblem-system-symbolic',
        icon_size: 20
      });
      const settingsBtn = new St.Button({
        reactive: true,
        can_focus: true,
        track_hover: true,
        accessible_name: "hatt2",
        style_class: 'system-menu-action',
        child: settingsIcon
      });
      settingsBtn.connect('clicked', () => {
        Util.spawn(['gnome-shell-extension-prefs', 'stocks-ticker@grigoriymikhalkin.github.io']);
      });
      menuBtnBox.add_child(settingsBtn);

      return menuBtnBox;
    }
  }
);

function init() {}

function enable() {
  indicator = new StocksTicker();
  Main.panel.addToStatusArea('stocksTicker', indicator);
}

function disable() {
  Mainloop.source_remove(labelRefreshTimeout);
  Mainloop.source_remove(dataRefreshTimeout);

  if (indicator !== null) {
    indicator.destroy();
    indicator = null;
  }
}

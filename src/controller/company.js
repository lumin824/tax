'use strict';

import Base from './base.js';
import _ from 'lodash';
import moment from 'moment';

import JsdsAPI from '../sysapi/jsds';
import JsgsAPI from '../sysapi/jsgs';
import CcAPI from '../sysapi/cc';

export default class extends Base {
  async indexAction(){
    let { id } = this.param();
    if(id){
      let item = await this.model('company').where({id}).find();
      let levelList = await this.model('company_level').where({company_id:id,is_visible:1}).select();
      this.assign({item,levelList});
      return this.display();
    }
    else{
      let { keyword } = this.param();
      let result = await this.model('company').where({'name':['LIKE',`%${keyword}%`]}).page(1,20).select();
      this.assign({result});
      return this.display('list');
    }
  }

  async checkAction(){
    let { id } = this.param();
    let item = await this.model('company_check').where({id}).find();
    if(item.from == '江苏国税')
    {
      this.assign(JSON.parse(item.fetch_info));
      return this.display('jsgs/show');
    }
    return this.display();
  }

  async _process(gs_api, ds_api, cc_api){
    let gs_data = await gs_api.data(),
        ds_data = await ds_api.data();

    let info = {
      ...ds_data.info, ...gs_data.info
    };

    let cc_data = await cc_api.data(info.name);

    info = {
      ...info,
      ...cc_data.info,
    };

    let taxMoneyList = _.mapValues(_.mapKeys(ds_data.taxMoneyList,'year'),o=>{
      let {year, ...oth} = o;
      return oth;
    });


    let taxList = _.sortBy([...gs_data.taxList, ...ds_data.taxList],'time');
    let taxValue = _.mapValues(_.groupBy(taxList, o=>o.time.split('-')[0]), o=>({tax:_.sumBy(o, o=>parseFloat(o.money))}));
    let { zczb } = info;
    zczb = parseInt(zczb);

    taxValue = _.merge(taxValue,taxMoneyList);

    taxValue = _.mapValues(taxValue, o=>({
      ...o,
      tax:o.tax && o.tax.toFixed(2),
      ts:o.tax > 1000 ? (Math.log(o.tax/1000)/Math.log(10)).toFixed(2) : '0.00',
      ga:(o.assets && o.tax) ? (100*o.tax/parseFloat(o.assets)).toFixed(2) : '0.00',
      ge:(o.equity && o.tax) ? (100*o.tax/parseFloat(o.equity)).toFixed(2) : '0.00',
      gi:(o.interest && o.tax) ? (o.tax/parseFloat(o.interest)).toFixed(2) :'0.00',
      gl:(o.liability && o.tax) ? (100*o.tax/parseFloat(o.liability)).toFixed(2) : '0.00',
      gr:(o.revenue && o.tax) ? (100*o.tax/parseFloat(o.revenue)).toFixed(2) : '0.00',
      gc:(o.capital && o.tax) ? (100*o.tax/parseFloat(o.capital)).toFixed(2) : '0.00',
    }));

    let cwbbList = [
      ...gs_data.cwbbList,
      ...ds_data.cwbbList
    ];

    let result = {
      gs_data,
      ds_data,
      cc_data,
      taxList,
      taxValue,
      info,
      cwbbList
    };

    result = JSON.stringify(result);
    this.model('company_apply').where({id}).update({result});
  }

  async applyAction(){
    if(this.isGet()){
      let { id } = this.param();
      if(id){
        let item = await this.model('company_apply').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
      let { id, ...data } = this.param();
      let ret = {};
      let current_unix = moment().unix();
      if(id){
        data.update_time = current_unix;
        await this.model('company_apply').where({id}).update(data);
        ret.reload = true;
      }else{
        data.create_time = current_unix;
        id = await this.model('company_apply').add(data);
        ret.redirect = `/company/apply?id=${id}`;
      }
      let gs_api = new JsgsAPI(),
          ds_api = new JsdsAPI(),
          cc_api = new CcAPI();

      let login_success = true;
      {
        let username = data.gs_username || data.uscc;
        let {errno:gs_errno,errmsg:gs_errmsg} = await gs_api.login(username, data.gs_password);
        while(~gs_errmsg.indexOf('验证码')){
          ({errno:gs_errno,errmsg:gs_errmsg} = await gs_api.login(username, data.gs_password));
        }
        if(gs_errno != '0') login_success = false;
        this.model('company_apply').where({id}).update({gs_errno, gs_errmsg});
      }
      {
        let username = data.ds_username || data.uscc;
        let {errno:ds_errno,errmsg:ds_errmsg} = await ds_api.login(username, data.ds_password);
        if(ds_errno != '0') login_success = false;
        this.model('company_apply').where({id}).update({ds_errno, ds_errmsg});
      }

      if(login_success){

        this._process(gs_api, ds_api, cc_api);
        ret.redirect = `/company/apply_result?id=${id}`;
      }

      return this.success(ret);
    }
  }

  async applyResultAction(){
    let { id } = this.param();
    let item = await this.model('company_apply').where({id}).find();
    this.assign({item, resultJson:JSON.parse(item.result)});
    return this.display();
  }

  async applyLastTimeAction(){
    let { id } = this.param();
    let { create_time, update_time } = await this.model('company_apply').where({id}).find();
    return this.success({ create_time, update_time });
  }
}

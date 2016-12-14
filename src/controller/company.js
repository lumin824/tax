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

  async _process(gs_api, ds_api, cc_api, id){
    let gs_data = gs_api ? (await gs_api.data()) : {},
        ds_data = ds_api ? (await ds_api.data()) : {};

    console.log('整合数据中...');
    let info = {
      ...ds_data.info, ...gs_data.info
    };

    console.log('整合1');

    let cc_data = await cc_api.data(info.name);

    info = {
      ...info,
      ...cc_data.info,
    };

    console.log('整合2');

    let taxMoneyList = _.mapValues(_.mapKeys(ds_data.taxMoneyList,'year'),o=>{
      let {year, ...oth} = o;
      return oth;
    });

    console.log('整合3');

    let taxList = _.sortBy([...gs_data.taxList, ...ds_data.taxList],'time');
    console.log('整合3.1');
    taxList = _.compact(taxList);
    console.log(taxList);
    let taxValue = _.mapValues(_.groupBy(taxList, o=>o.time.split('-')[0]), o=>({tax:_.sumBy(o, o=>parseFloat(o.money))}));
    console.log('整合3.2');
    let { zczb } = info;
    console.log('整合3.3');
    zczb = parseInt(zczb);

    console.log('整合4');

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


    console.log('整合5');

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

    console.log('整合6');

    result = JSON.stringify(result);
    this.model('company_apply').where({id}).update({
      name: info.name,
      result,review_status:'1'});
  }

  async _process_cc(cc_api, id, name, uscc, gs_username, ds_username){

    let cc_data = await cc_api.data(name);

    let info = {
      ...cc_data.info,
    };

    let result = {
      info,
      cc_data,
    };

    result = JSON.stringify(result);
    this.model('company_apply').where({id}).update({
      name: info.name,
      result,review_status:'1'});
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
        data.review_status = '';
        data.gs_errno = data.gs_errmsg = '';
        data.ds_errno = data.ds_errmsg = '';
        await this.model('company_apply').where({id}).update(data);
        ret.reload = true;
      }else{
        data.create_time = current_unix;
        data.review_status = '';
        id = await this.model('company_apply').add(data);
        ret.reload = true;
      }

      let area_code = '';
      if(data.uscc.length == 18) area_code = data.uscc.substr(2,2);
      else if(data.gs_username) area_code = data.gs_username.substr(0,2);
      else if(data.ds_username) area_code = data.ds_username.substr(0,2);

      let gs_api, ds_api,
          cc_api = new CcAPI();
      if(area_code == '32'){
        gs_api = new JsgsAPI();
        ds_api = new JsdsAPI();
      }

      console.log('国税验证中...')
      if(gs_api){
        let username = data.gs_username || data.uscc;
        let {errno:gs_errno,errmsg:gs_errmsg} = await gs_api.login(username, data.gs_password);
        while(gs_errno == 'ERR_03'){
          ({errno:gs_errno,errmsg:gs_errmsg} = await gs_api.login(username, data.gs_password));
        }
        if(gs_errno != '0') gs_api = null;
        console.log('国税登录结果:'+gs_errno+'='+gs_errmsg);
        this.model('company_apply').where({id}).update({gs_errno, gs_errmsg});
      }

      console.log('地税验证中...')
      if(ds_api){
        let username = data.ds_username || data.uscc;
        let {errno:ds_errno,errmsg:ds_errmsg} = await ds_api.login(username, data.ds_password);
        while(ds_errno == 'ERR_03'){
          ({errno:ds_errno,errmsg:ds_errmsg} = await ds_api.login(username, data.ds_password));
        }
        if(ds_errno != '0') ds_api = null;
        console.log('地税登录结果:'+ds_errno+'='+ds_errmsg);
        this.model('company_apply').where({id}).update({ds_errno, ds_errmsg});
      }

      await this.model('company_apply').where({id}).update({
        review_status:'3'
      });

      if(gs_api || ds_api)
        this._process(gs_api, ds_api, cc_api, id);
      else
        this._process_cc(cc_api, id, data.name, data.uscc, data.gs_username, data.ds_username);
      //ret.redirect = `/company/apply_result?id=${id}`;
      ret.reload = true;

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

  async searchAction(){
    let { keyword } = this.param();

    if(keyword){
      let result = await this.model('company_apply').where({'name|uscc':['LIKE', `%${keyword}%`],review_status:'2'}).page(0,20).select();
      if(think.isEmpty(result)){
        return this.redirect(`/cc?keyword=${encodeURIComponent(keyword)}`);
      }
      this.assign({result});
    }
    return this.display();
  }
}

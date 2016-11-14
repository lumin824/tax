'use strict';

import Base from './sysbase.js';
import crypto from 'crypto';
import cheerio from 'cheerio';
import _ from 'lodash';
import url from 'url';

export default class extends Base {
  async indexAction(){

    let httpClient = await this.getOrCreateHttpClient();
    if(this.isAjax()){
      let { username, password, captcha:yzm } = this.param();
      let [ loginmode, causername, cacert, signature ] = ['00', '', '',''];
      let { DLM } = await new Promise((resolve, reject)=>{
        httpClient.post('http://etax.jsgs.gov.cn/sso/swryHandler', {
          form: { loginmode, causername, username },
          qs: { method: 'upgradePrompt' }
        }, (error, response, body)=>{
          if(error) reject(error);
          else resolve(JSON.parse(body));
        });
      });

      let { action, execution, lt, _eventId } = await new Promise((resolve, reject)=>{
        httpClient.get('http://etax.jsgs.gov.cn/portal/login.do', (error, response, body)=>{
          if(error) reject(error);
          else{
            let $ = cheerio.load(body);
            resolve({
              action: $('#fm1').attr('action'),
              execution:$('[name=execution]').val(),
              lt:$('[name=lt]').val(),
              _eventId:$('[name=_eventId]').val()
            });
          }
        });
      });

      let sha256 = crypto.createHash('sha256');
      sha256.update(`${password}{${DLM}}`);
      let form = {
        username, password:sha256.digest('hex'), yzm,
        loginmode, causername, cacert,signature,
        execution, lt, _eventId
      };

      let body = await new Promise((resolve, reject)=>{
        httpClient.post(`http://etax.jsgs.gov.cn${action}`, {form,followAllRedirects:true}, (error, response, body)=>{
          if(error) reject(error);
          else resolve(body);
        });
      });

      let m = body.match(/layerHandler[.]alert[(]"(.*)"[)]/g);
      if(m && m.length == 11){
        let msg = m[2].match(/layerHandler[.]alert[(]"(.*)"[)]/)[1];
        this.error(msg);
      }else{
        this.success({redirect:'/jsgs/show'});
      }

    }
    else{
      let result = await new Promise((resolve, reject)=>{
        httpClient.get('http://etax.jsgs.gov.cn/sso/login', (error, response, body)=>{
          if(error)reject(error);
          else{
            resolve(body);
          }
        });
      });
      this.assign({
        result
      })
      return this.display();
    }
  }

  async captchaAction(){
    let httpClient = await this.getOrCreateHttpClient();
    httpClient.get('http://etax.jsgs.gov.cn/sso/captcha').pipe(this.http.res);
  }

  async showAction(){
    let httpClient = await this.getOrCreateHttpClient();
    let res;

    let info;
    res = await this.httpGet('http://etax.jsgs.gov.cn/portal/index.do');
    if(res.body){
      let $ = cheerio.load(res.body);
      let $info = $('#div_user_info div div div');
      info = {
        nsrmc: $info.eq(0).text(),
        nsrsbh: $info.eq(2).text()
      };
    }

    let token = '';
    res = await this.httpGet('http://etax.jsgs.gov.cn/portal//queryapi/private/commonPage.do', {
      qs:{sign:'query_swdjxx'}
    });
    if(res.body){
      let m = res.body.match(/token\s*:\s*"(\S+)"/);
      if(m) token = m[1];
    }

    let swdjxx;
    res = await this.httpPost('http://etax.jsgs.gov.cn/portal/queryapi/private/query.do', {
      form:{request:JSON.stringify({action:'query_swdjxx_dwnsr',token,body:{sign:'query_swdjxx_dwnsr'}}) }
    });
    if(res.body){
      swdjxx = JSON.parse(JSON.parse(res.body).DATA);
    }

    let tzfxx;
    res = await this.httpPost('http://etax.jsgs.gov.cn/portal/queryapi/private/query.do', {
      form:{request:JSON.stringify({action:'query_swdjxx_dwnsr_tzfxx',token,body:{sign:'query_swdjxx_dwnsr_tzfxx'}}) }
    });
    if(res.body){
      tzfxx = JSON.parse(JSON.parse(res.body).DATA).rows;
    }

    let skjn;
    res = await this.httpPost('http://etax.jsgs.gov.cn/portal/queryapi/private/query.do', {
      form:{request:JSON.stringify({action:'query_skjncx',token,body:{sign:'query_skjncx',tj0:'2000-01-01',tj1:'3000-01-01'}}) }
    });
    if(res.body){
      skjn = JSON.parse(JSON.parse(res.body).DATA).rows;
    }
    let skjn_hj = _.sumBy(skjn,o=>parseFloat(o.sjse));

    await this.httpPost('http://etax.jsgs.gov.cn/portal//user/my_app/forbiddenApp.do');
    await this.httpPost('http://etax.jsgs.gov.cn/portal/home/index/shortcut_appmanage.do', {
      qs: {sign:'query', type:'all'}
    });

    // 应用列表
    let appList;
    res = await this.httpPost('http://etax.jsgs.gov.cn/portal/user/my_app/app_manage.do', {
      qs: {sign:'query', type:'all'}
    });
    if(res.body){
      appList = JSON.parse(res.body).DATA;
    }

    appList = _.map(appList, o=>({
      app_dm:o.app_dm,
      app_bbh:o.bbh,
      appNo:o.appNo,
      sf_mk:o.sf_mk,
      app_url:o.app_url,
      appb_jxlx:o.appb_jxlx,
      app_mc:o.app_mc
    }));

    // 财务报表
    let { app_mc, ...form } = _.find(appList, {app_dm:'shenbao.yjd.cwbb'});
    let cwbbapp;
    res = await this.httpPost('http://etax.jsgs.gov.cn/portal/user/my_app/app_manage.do', {
      qs: {sign:'to_app'}, form
    });
    if(res.body){
      cwbbapp = JSON.parse(res.body).DATA;
    }
    console.log(cwbbapp.url)

    let path;
    let cwbbapp_home;
    res = await this.httpGet(cwbbapp.url, {followRedirect:false});
    path = res.response.headers['location'];
    console.log(path);

    res = await this.httpGet(path, {followRedirect:false});
    path = res.response.headers['location'];
    console.log(path);

    res = await this.httpGet(path, {followRedirect:false});
    path = res.response.headers['location'];

    if(res.response){
      // console.log(res.response.request.headers);
      // console.log(res.response.headers);
      //console.log(res.body)
      //cwbbapp_home = res.response.headers['location'];
    }
    //console.log(res.body);


      // let home = await new Promise((resolve, reject)=>{
      //   httpClient.get(cwbbapp.url,(error, response, body)=>{
      //     if(error) reject(error);
      //     else resolve(body);
      //   });
      // });
      //console.log(home);


      // let sbcxUrl =  url.resolve(apphome, 'sbcxAction.action');
      // console.log(sbcxUrl);



      // let sbList = await new Promise((resolve, reject)=>{
      //   httpClient.post(sbcxUrl, {
      //     qs:{sign:'queryData',sb_type:'16'},
      //     form: {begin_skssq:'',end_skssq:'',sbrq:'',zt:'1'}
      //   }, (error,response, body)=>{
      //     if(error) reject(error);
      //     else resolve(body);
      //   });
      // });
      //
      // console.log(sbList);

    let grid = {
      a:[],c:[]
    };

    grid.a[0] = (Math.log(skjn_hj / 1000) / Math.log(10)).toFixed(2);

    grid.c[0] = (100 * skjn_hj / parseFloat(swdjxx.ZCZB)).toFixed(2);

    this.assign({info,swdjxx,tzfxx,skjn, skjn_hj, grid});
    this.model('company').add({id:info.nsrsbh, name:info.nsrmc, type:'jsgs',info,swdjxx,tzfxx,skjn, skjn_hj, grid });

    return this.display();
  }
}


import Base from './base';

import _ from 'lodash';
import fs from 'fs';
import gm from 'gm';
import uuid from 'node-uuid';
import tesseract from 'node-tesseract';

import crypto from 'crypto';
import cheerio from 'cheerio';
import url from 'url';
import moment from 'moment';
import md5File from 'md5-file';

export default class extends Base {
  fetchCaptcha(){
    let codePath = 'code_' + uuid.v1() + '.jpg';
    return new Promise((resolve, reject)=>{
      let stream = gm(this.httpClient.get('http://etax.jsgs.gov.cn/sso/captcha'))
        .operator('gray', 'threshold', 50, true).stream();
      stream.pipe(fs.createWriteStream(codePath));
      stream.on('end', ()=>{
        tesseract.process(codePath, (error, text)=>{
          fs.unlink(codePath);
          error ? reject(error) : resolve(_.trim(text).replace(/[^\d\w]+/g,''));
        });
      });
    });
  }
  async login(username, password){
    let [ loginmode, causername, cacert, signature ] = ['00', '', '',''];

    let res = await this.httpPost('http://etax.jsgs.gov.cn/sso/swryHandler',{
      form: { loginmode, causername, username },
      qs: { method: 'upgradePrompt' }
    });
    let { DLM } = JSON.parse(res.body);

    if(!DLM){
      return {errno:'ERR_01', errmsg:'代码错误'}
    }

    res = await this.httpGet('http://etax.jsgs.gov.cn/portal/login.do');
    let $ = cheerio.load(res.body);
    let action = $('#fm1').attr('action'),
        execution = $('[name=execution]').val(),
        lt = $('[name=lt]').val(),
        _eventId = $('[name=_eventId]').val();

    let sha256 = crypto.createHash('sha256');
    sha256.update(`${password}{${DLM}}`);

    let yzm = await this.fetchCaptcha();
    while(yzm.length != 4){
      yzm = await this.fetchCaptcha();
    }

    let form = {
      username, password:sha256.digest('hex'), yzm,
      loginmode, causername, cacert,signature,
      execution, lt, _eventId
    };

    res = await this.httpPost(`http://etax.jsgs.gov.cn${action}`, {form,followAllRedirects:true});

    let errkey = 'if(_returncode!=""&&_returncode!="0000"){';
    let erridx = res.body.indexOf(errkey);
    let errno = '', errmsg = '';
    if(~erridx){
      let body = res.body;
      errno = body.substring(body.lastIndexOf('_returncode', erridx), erridx);
      erridx += errkey.length;
      errmsg = body.substring(erridx, body.indexOf(');', erridx));
      errno = errno.match(/["](.*)["]/)[1];
      errmsg = errmsg.match(/["](.*)["]/)[1];
    }

    if(errno==''||errno=='0000'){
      errno = '0';
      errmsg = '';
    }else{
      if(errno == '0001'){
        errno = 'ERR_02';
        errmsg = '密码错误';
      }else{
        errno = 'SYS_' + errno;
      }
    }

    return {errno, errmsg};
  }

  async fetch_token(){
    let res = await this.httpGet('http://etax.jsgs.gov.cn/portal//queryapi/private/commonPage.do', {
      qs:{sign:'query_swdjxx'}
    });
    let m = res.body.match(/token\s*:\s*"(\S+)"/);
    return m ? m[1]:'';
  }

  async fetch_swdjxx(){

    if(!this._token){
      this._token = await this.fetch_token();
    }

    let token = this._token;


    let swdjxx;
    let res = await this.httpPost('http://etax.jsgs.gov.cn/portal/queryapi/private/query.do', {
      form:{request:JSON.stringify({action:'query_swdjxx_dwnsr',token,body:{sign:'query_swdjxx_dwnsr'}}) }
    });
    if(res.body){
      swdjxx = JSON.parse(JSON.parse(res.body).DATA);
    }

    res = await this.httpPost('http://etax.jsgs.gov.cn/portal/queryapi/private/query.do', {
      form:{request:JSON.stringify({action:'query_swdjxx_dwnsr_tzfxx',token,body:{sign:'query_swdjxx_dwnsr_tzfxx'}}) }
    });
    if(res.body){
      swdjxx.tzfxx = JSON.parse(JSON.parse(res.body).DATA).rows;
    }

    return swdjxx;
  }

  async fetch_skjn(tj0,tj1){
    if(!this._token){
      this._token = await this.fetch_token();
    }

    let token = this._token;
    let skjn;
    let res = await this.httpPost('http://etax.jsgs.gov.cn/portal/queryapi/private/query.do', {
      form:{request:JSON.stringify({action:'query_skjncx',token,body:{sign:'query_skjncx',tj0,tj1}}) }
    });
    skjn = JSON.parse(JSON.parse(res.body).DATA).rows;
    // let skjn_hj = _.sumBy(skjn,o=>parseFloat(o.sjse));

    return skjn;
  }

  async find_app(app_dm){
    if(!this._appList){
      let res = await this.httpPost('http://etax.jsgs.gov.cn/portal/user/my_app/app_manage.do', {
        qs: {sign:'query', type:'all'}
      });

      this._appList = _.map(JSON.parse(res.body).DATA, o=>({
        app_dm:o.app_dm,
        app_bbh:o.bbh,
        appNo:o.appNo,
        sf_mk:o.sf_mk,
        app_url:o.app_url,
        appb_jxlx:o.appb_jxlx,
        app_mc:o.app_mc
      }));
    }

    return _.find(this._appList, {app_dm});
  }

  async to_app(form){
    let res = await this.httpPost('http://etax.jsgs.gov.cn/portal/user/my_app/app_manage.do', {
      qs: {sign:'to_app'}, form
    });
    let app = JSON.parse(res.body).DATA;

    res = await this.httpGet(app.url, {headers:{
      'Referer':'http://etax.jsgs.gov.cn/portal/index.do'
    }});

    return res.response.request.uri.href;
  }

  async fetch_wspz(begin_jkrq,end_jkrq,sphm_par){
    if(!this._cwbbBaseUrl){
      let { app_mc, ...form } = await this.find_app('shenbao.yjd.cwbb');
      this._cwbbBaseUrl = await this.to_app(form);
    }

    let res = await this.httpPost(url.resolve(this._cwbbBaseUrl,'wspzdyAction.action'), {
      qs:{sign:'queryWspz'},
      form:{begin_jkrq,end_jkrq,sphm_par}
    });

    let $ = cheerio.load(res.body);
    return _.map($('tbody tr').toArray(), o=>{
      return {
        sphm: $('input[name=sphm]', o).val(),
        zsxmmc: $('input[name=zsxmmc]', o).val(),
        sksxmc: $('input[name=sksxmc]', o).val(),
        skssqq: $('input[name=skssqq]', o).val(),
        skssqz: $('input[name=skssqz]', o).val(),
        sjse: $('input[name=sjse]', o).val(),
        jkrq: $('input[name=jkrq]', o).val(),
      }
    });
  }

  async fetch_cwbb(begin_skssq,end_skssq){
    if(!this._cwbbBaseUrl){
      let { app_mc, ...form } = await this.find_app('shenbao.yjd.cwbb');
      this._cwbbBaseUrl = await this.to_app(form);
    }

    let res = await this.httpPost(url.resolve(this._cwbbBaseUrl,'sbcxAction.action'), {
      qs:{sign:'queryData',sb_type:'16'},
      form:{begin_skssq,end_skssq,sbrq:'',zt:'1'}
    });

    let $ = cheerio.load(res.body);
    return _.map($('table tbody tr').toArray(), o=>{
      let td = $('td', o);
      return {
        nsrsbh:_.trim(td.eq(0).text()),
        sbbbmc:_.trim(td.eq(1).text()),
        sbssq:_.trim(td.eq(2).text()),
        sbrq:_.trim(td.eq(3).text()),
        ybsk:_.trim(td.eq(4).text()),
        sbzt:_.trim(td.eq(5).text()),
        href:$('[name=pdfInfo]', td.eq(6)).val()
      };
    });
  }

  async fetch_pdf(href){
    if(!this._cwbbBaseUrl){
      let { app_mc, ...form } = await this.find_app('shenbao.yjd.cwbb');
      this._cwbbBaseUrl = await this.to_app(form);
    }

    return Promise.all(_.map(href.split(';'), async o=>{
      let os = o.split(':');

      let code2name = {
        '1':'资产负债表',
        '2':'利润表',
        '3':'现金流量表'
      }

      let code = os[0];
      let endCode = code.charAt(code.length-1);
      let name = code2name[endCode] || code,
          uuid = os[1];

      let res = await this.httpPost(url.resolve(this._cwbbBaseUrl,'sbcxAction.action'), {
        encoding: null,
        qs:{sign:'getPdfInfo',uuid,type:'download'}
      });

      let tempFile = `runtime/jsgs_${uuid}.pdf`;
      fs.writeFileSync(tempFile,res.body);
      let hash = md5File.sync(tempFile);
      fs.renameSync(tempFile, think.RUNTIME_PATH + '/archive/' + hash);
      return { name,hash };

    }));


  }

  async data(){
    let swdjxx = await this.fetch_swdjxx();
    //let skjn = await this.fetch_skjn('2012-01-01','2016-12-31');
    let wspz = await this.fetch_wspz('2012-01-01','2016-12-31','');

    let taxList = _.map(wspz, o=>(
      {name:o.sksxmc, money:o.sjse, time:o.jkrq, remark:'国税-完税凭证'}
    ));

    let cwbb = await this.fetch_cwbb('2013-01','2017-01');

    let cwbbList = await Promise.all(_.map(cwbb, async o=>({
      name: o.sbbbmc,
      time: o.sbrq,
      archiveList: await this.fetch_pdf(o.href),
      remark: '国税'
    })));

    let info = {
      name: swdjxx.NSRMC,
      nsrsbh: swdjxx.NSRSBH,
      zczb: swdjxx.ZCZB,
      zzjgdm: swdjxx.ZZJG_DM,
      tzfxx: _.map(swdjxx.tzfxx, o=>({
        tzfmc: o.TZFHHHRMC,
        jjxz:o.JJXZMC,
        tzbl:o.TZBL,
        zjzl:o.SFZJLXMC,
        zjhm:o.TZFHHHRZJHM,
        gjdz:o.GJHDQJC,
      }))
    }
    if(swdjxx.NSRSBH.length == 18) info.uscc = swdjxx.NSRSBH;
    return {info,swdjxx,wspz,taxList,cwbb, cwbbList};
  }
}

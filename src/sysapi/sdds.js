
import Base from './base';

import _ from 'lodash';
import fs from 'fs';
import gm from 'gm';
import uuid from 'node-uuid';
import tesseract from 'node-tesseract';

import cheerio from 'cheerio';
import md5File from 'md5-file';
import moment from 'moment';
import crypto from 'crypto';

import url from 'url';
import qs from 'qs';
//
// /*
//  * 通用查询工具
//  */
// //将id转换成jquery selector的格式
// function parseSelector(id) {
// 	var temp = id.replace(/\./g, '\\.');
// 	temp = temp.replace(/\[/g, "\\[");
// 	temp = temp.replace(/\]/g, "\\]");
// 	return temp;
// }
// // 将key,value封装到entry报文
// function creatParamMap(key, value) {
// 	var xml = "<entry><key>" + key + "</key><value>" + value
// 			+ "</value></entry>";
// 	return xml;
// }
// // 获取所有数据报文
// function getAllDataXml(params, sqlId) {
// 	var bizXml = "<tycxParam>";
// 	bizXml += "<sqlID>" + sqlId + "</sqlID>"; // 查询sqlID
// 	bizXml += "<pageFlag>N</pageFlag>";
// 	bizXml += "<params>";
// 	paramIds = params.split('||');
// 	for ( var i = 0; i < paramIds.length; i++) {
// 		param = parseSelector(paramIds[i]);
// 		if ($.trim($('#' + param).val()) != '') {
// 			bizXml += creatParamMap($('#' + param).attr('name'), $('#' + param)
// 					.val());
// 		}
// 	}
// 	bizXml += "</params></tycxParam>";
// 	return bizXml;
// }


export default class extends Base {
  fetchCaptcha(){
    let codePath = 'code_' + uuid.v1() + '.jpg';
    return new Promise((resolve, reject)=>{
      let stream = gm(this.httpClient.get('http://wsbs.sdds.gov.cn/etax/captcha.jpg'))
        .operator('gray', 'threshold', 60, true).stream();
      stream.pipe(fs.createWriteStream(codePath));
      stream.on('end', ()=>{
        tesseract.process(codePath, (error, text)=>{
          fs.unlink(codePath);
          error ? reject(error) : resolve(_.trim(text));
        });
      });
    });
  }
  async login(username, password){

    let captcha = await this.fetchCaptcha();
    while(captcha.length != 4){
      captcha = await this.fetchCaptcha();
    }

    let ret = await this.httpPost('http://wsbs.sdds.gov.cn/etax/etax_login', {
      form: {
        _eventId:'submit', method:'nsrUP',license:'',no:'',name:'',userType:'QY',
        wsaction:'',username,password, captcha_key:captcha
      }
    });
    let errmsg, errno;
    let { location } = ret.response.headers;
    console.log(location);
    if(location == 'http://wsbs.sdds.gov.cn/etax/index.do'){
      errno = '0';
      errmsg = '';
    }else{
      let { login_error } = qs.parse(url.parse(location).query);
      if(login_error == 'E006'){
        errno = 'ERR_01';
        errmsg == '代码错误';
      }else if(login_error == 'user_not_found'){
        errno = 'ERR_02';
        errmsg = '密码错误';
      }else{
        errno = 'SYS_'+login_error;
        errmsg = login_error;
      }
    }
    return {errno, errmsg};
  }

  async fetch_nsrjbxx(){
    let ret = await this.httpGet('http://wsbs.sdds.gov.cn/etax/admin/desktop.do');
    let m = ret.body.match(/parent.etaxGlobal.nsrInfo = {([\s\S]+?)};/)
    return _.mapValues(_.mapKeys(_.map(m[1].split(','), o=>{
      let str = _.trim(o);
      let mm = str.match(/(.*) : "(.*)"/);
      return [mm[1],mm[2]];
    }), o=>o[0]),o=>o[1]);
  }

  async fetch_jkxx(nsrsbh,djxh,bgrqq,bgrqz){

    let ret = await this.httpGet('http://wsbs.sdds.gov.cn/etax/admin/sso.do',{
      qs:{
        showType:'showInNewWindow',targetUrl:'/tycx/tycx/tycx.do',action:'toTycxFrame',
        menuId:'SBXXCX_QGTG',showParam:'{status:\' no \'}',gnId:'D4E575FCE0664B5787C2654B06DD0001',
        gnDm:'CX_38131701',treeId:'146119707D52581CE053C2000A0AAF71',gdslxDm:'null',
        gnId:'D4E575FCE0664B5787C2654B06DD0001',gnDm:'CX_38131701'
      }
    });
    let redirect = ret.body.match(/window[.]location[.]href = "(.*)"/)[1];
    await this.httpGet(`http://wsbs.sdds.gov.cn${redirect}`);

    let form = { bizXml: ''
        +`<tycxParam>`
        +`<sqlID>qureyJsfjgcx</sqlID>`
        +`<pageFlag>Y</pageFlag>`
        +`<perNum>10</perNum>`
        +`<params>`
          +`<entry><key>nsrsbh</key><value>${nsrsbh}</value></entry>`
          +`<entry><key>kkfs</key><value>51</value></entry>`
          +`<entry><key>bgrqq</key><value>${bgrqq}</value></entry>`
          +`<entry><key>bgrqz</key><value>${bgrqz}</value></entry>`
          +`<entry><key>kkzt</key><value>03</value></entry>`
          +`<entry><key>djxh</key><value>${djxh}</value></entry>`
          +`<entry><key>beignRow</key><value>1</value></entry>`
          +`<entry><key>endRow</key><value>10</value></entry>`
        +`</params></tycxParam>`,sid:'ETax.TY.qureydata', action:'queryData'
    };
    let headers = {
      'Accept':'text/plain;charset=UTF-8',
      'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With':'XMLHttpRequest',
      'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36'
    }

    ret = await this.httpPost('http://wsbs.sdds.gov.cn/tycx/tycx/tycx.do', {form,headers});

    let $ = cheerio.load(ret.body);
    let tid = $('tid').text();
    ret = await this.httpPost('http://wsbs.sdds.gov.cn/tycx/tycx/tycx.do', {form:{
      action:'queryHandleResult',sid:'ETax.TY.qureydata',
      tid
    },headers})

    $ = cheerio.load(ret.body);
    let list = _.map($('datas data').toArray(),o=>({
      SKSSQ_Q:$('SKSSQ_Q',o).text(),
      YZPZXH:$('YZPZXH',o).text(),
      YZPZMXXH:$('YZPZMXXH',o).text(),
      RZLSH:$('RZLSH',o).text(),
      SJGSDQ:$('SJGSDQ',o).text(),
      ZSXM_DM:$('ZSXM_DM',o).text(),
      RN:$('RN',o).text(),
      LRRQ:$('LRRQ',o).text(),
      KKFH_DM:$('KKFH_DM',o).text(),
      BD_DM:$('BD_DM',o).text(),
      SJGSRQ:$('SJGSRQ',o).text(),
      ZSPM_DM:$('ZSPM_DM',o).text(),
      DZSPHM:$('DZSPHM',o).text(),
      KKFHXX:$('KKFHXX',o).text(),
      JKJE:$('JKJE',o).text(),
      JKQX:$('JKQX',o).text(),
      DJXH:$('DJXH',o).text(),
      SKSSQ_Z:$('SKSSQ_Z',o).text(),
      GNID:$('GNID',o).text()
    }));
    return list;
  }

  async data(){

    let nsrjbxx = await this.fetch_nsrjbxx();
    let jkxx = await this.fetch_jkxx(nsrjbxx.nsrsbh,nsrjbxx.djxh,'2012-01-01','2016-12-31');

    let taxList = _.map(jkxx, o=>(
      {name:o.ZSXM_DM, money:o.JKJE, time:o.LRRQ, remark:'地税-缴款信息'}
    ))
    //console.log(nsrjbxx);
    return {taxList};
  }
}

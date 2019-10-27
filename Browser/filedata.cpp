#include <QLineEdit>
#include <QFile>
#include <QJsonArray>
#include <QJsonObject>
#include <QJsonValue>
#include <QString>
#include <QRegExp>

#include <iostream>
#include <set>
#include <math.h>

using namespace std;    // so sue me

#include "filedata.h"

// Highlight data in edt: yellow background whole of line, red text between starthl and endhl
// Note that cursor positioning ignores line ends ('\n'), so need to subtract these when passing params
void FileData::highlight(QTextEdit* edt, int startline, int endline, int starthl, int endhl, QColor bg, QColor fg)
{
	QTextCharFormat origfmt = edt->currentCharFormat();
	QTextCharFormat highlightRow(origfmt);
	highlightRow.setBackground(bg);
	QTextCharFormat highlightString(highlightRow);
	highlightString.setForeground(fg);

	// highlight whole row first, then "over"-highlight middle section.
	QTextCursor cursor(edt->document());
	cursor.setPosition(startline, QTextCursor::MoveAnchor);
	cursor.setPosition(endline, QTextCursor::KeepAnchor);
	cursor.setCharFormat(highlightRow);
	cursor.setPosition(starthl, QTextCursor::MoveAnchor);
	cursor.setPosition(endhl, QTextCursor::KeepAnchor);
	cursor.setCharFormat(highlightString);
}

// Split above into separate file? (qq)

FileData::FileData(const QString fname, size_t sz)
{
	name = fname.left(fname.length()-5);
	if (name.contains('/')) name = name.right(name.length() - name.lastIndexOf('/') - 1);
	size = sz;

	QFile file(fname);
	if (!file.open(QIODevice::ReadOnly)) {
		cerr << "Error opening " << fname.toLatin1().data() << endl;
		return;
	}

	array = file.readAll();
	rawdata = array.data();

	json = QJsonDocument::fromJson(array);
}

void FileData::populateRawData(QTextEdit* edt)
{
	edt->setText(rawdata);
}

void FileData::populateParsedData(QTextEdit* edt)
{
	edt->setText(json.toJson(QJsonDocument::Indented));
}

void FileData::populateTree(QTreeWidget* tree)
{
	tree->clear();

	if (json.isObject()) {
		// It's a seasonal file
	}
	else if (json.isArray()) {
		// It's a normal file
		// We should have an array of objects, each containing an id
		QJsonArray array = json.array();
		set<QString> columns;   // find all the unique top level keys;
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			for (auto j : v.keys())
				columns.insert(j);
		}
		tree->setColumnCount(columns.size());
		QStringList cols;
		cols << "id";                   // We always want id to be first
		columns.erase("id");
		if (columns.count("name")) {    // human readable version of id (if present), let's have this column next
			cols << "name";
			columns.erase("name");
		}
		for (auto i : columns)          // the rest of the columns will be in alphabetic order
			 cols << i;
		tree->setHeaderLabels(cols);
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QTreeWidgetItem* hdr = tree->headerItem();
			QTreeWidgetItem* ti = new QTreeWidgetItem();
			for (int c=0; c < tree->columnCount(); c++) {
				if (v.contains(hdr->text(c))) {
					ti->setText(c, strip_string(json_lookup(v, hdr->text(c))));
				}
				tree->addTopLevelItem(ti);
			}
		}
		for (int c=0; c < tree->columnCount(); c++) {
			tree->resizeColumnToContents(c);	// some columns will be very wide
		}
	}
	else {
		cerr << "Json wasn't an object or array\n";
	}
}

void FileData::populateWiki(QTextEdit* edt)
{
	if (name == "") return;
	if (name == "seasonal") return;

	// Populate edt in wiki markup format.
	// Unfortunately a lot of hard-coded stuff here
	edt->clear();

	if (!json.isArray()) return;

	QJsonArray array = json.array();
	QStringList s_array;	// to allow sorting
	if (name == "encounters") {
		wiki_table(edt);
		edt->append("! Name !! Effect !! Benefit/Loot");
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QString row;
			row += "| <span id=\"" + name_or_id(v) + "\">" + name_or_id(v) + "</span> || " +
			        strip_string(json_lookup(v, "effect")) + " || " + strip_string(join_fields(v, "loot", "result"));
			s_array.append(row);
		}
	}
	else if (name == "homes") {
		wiki_table_sortable(edt);
		edt->append("! Name !! data-sort-type=\"number\"|Size !! Cost !! Requires !! Effect");
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QString row;
			QString size = QString::asprintf("%.0f", v["mod"].toObject()["space.max"].toDouble());
			row += "| " + name_or_id(v) + " || " + size + " || " + strip_string(json_lookup(v, "cost")) + " || " + strip_string(json_lookup(v, "require")) +
			        " || " + strip_field(strip_string(json_lookup(v, "mod")), "space.max");
			s_array.append(row);
		}
	}
	else if (name == "monsters") {
		wiki_table_sortable(edt);
		edt->append("! Name !! data-sort-type=\"number\"|Level !! data-sort-type=\"number\"|HP !! data-sort-type=\"number\"|Defense !! data-sort-type=\"number\"|Regen !! "
		            "data-sort-type=\"number\"|To hit !! data-sort-type=\"number\"|speed !! Damage !! Resist !! Loot");
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QString row;
			QString dmg = json_lookup(v, "damage");
			if (dmg == "") dmg = json_lookup(v, "attack");
			row += "| <span id=\"" + name_or_id(v) + "\">" + name_or_id(v) + "</span> || " + json_lookup(v, "level") + " || " + json_lookup(v, "hp") + " || " +
			        json_lookup(v, "defense") + " || " + json_lookup(v, "regen") + " || " + json_lookup(v, "tohit") + " || " + json_lookup(v, "speed") + " || " +
			        strip_string(dmg).remove("dmg ").remove("kind ").remove("name ") + " || " + strip_string(json_lookup(v, "resist")) + " || " + strip_string(json_lookup(v, "loot"));

			s_array.append(row);
		}
	}
	else if (name == "skills") {
		wiki_table_sortable(edt);
		edt->append("! Name !! Cost !! Benefit !! Requires");
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QString row;
			QString cost = json_lookup(v, "buy");
			row += "| [[" + name_or_id(v) + "]] || " + (cost == "" ? "sp 1" : strip_string(cost)) + " || " +
			        strip_string(join_fields(v, "result", "mod")) + " || " +
			        strip_string(join_fields(v, "need", "require"));
			s_array.append(row);
		}
	}
	else if (name == "spells") {
		wiki_table_sortable(edt);
		edt->append("! Name !! School !! data-sort-type=\"number\"|Level !! Upgradeable !! Cast cost !! Purcase cost !! Requires");
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QString row;
			row += "| " + name_or_id(v) + " || " + json_lookup(v, "school") + " || " + json_lookup(v, "level") + " || " + (json_lookup(v, "at") != "" ? "Y" : "&nbsp;") + " || " +
			        strip_string(json_lookup(v, "cost")) + " || " + strip_string(json_lookup(v, "buy")) + " || " + strip_string(json_lookup(v, "require"));
			s_array.append(row);
		}
	}
	else if (name == "upgrades") {
		wiki_table_sortable(edt);
		edt->append("! Name !! Max !! Cost !! Benefit !! Requires");
		for (auto const i : array) {
			if (!i.isObject()) {
				cerr << "Expected an object\n";
				continue;
			}
			QJsonObject v = i.toObject();
			QString row;
			row += "| [[" + name_or_id(v) + "]] || " + json_lookup(v, "max") + " || " + strip_string(join_fields(v, "buy", "cost")) + " || " +
			        strip_string(join_fields(v, "effect", "mod")) + " || " +strip_string(json_lookup(v, "require"));
			s_array.append(row);
		}
	}
	else {
		// not yet supported
		edt->append(name + " not yet supported for wiki output");
		return;
	}

	s_array.sort();
	for (auto i : s_array) {
		wiki_row(edt);
		append(edt, i);
	}
	wiki_trailer(edt);
}

// Look up key in json object. If not present return "" else convert value to a string
QString FileData::json_lookup(const QJsonObject& j, const QString& key)
{
	if (!j.contains(key)) return "";

	QJsonValue jv = j[key];
	if (jv.isString())
		return jv.toString();
	if (jv.isBool())
		return jv.toBool() ? "true" : "false";
	if (jv.isDouble()) {
		double d = jv.toDouble();
		if (d == floor(d))	// Don't want trailing 0
			return QString::asprintf("%.0f", jv.toDouble());
		else
			return QString::asprintf("%f", jv.toDouble()).remove(QRegExp("0+$"));
	}
	if (jv.isArray()) {	// just generate a compact string for now, but could populate children in tree
		QJsonDocument jdoc(jv.toArray());
		return jdoc.toJson(QJsonDocument::Compact);
	}
	if (jv.isObject()) {
		QJsonDocument jdoc(jv.toObject());
		return jdoc.toJson(QJsonDocument::Compact);
	}
	return "";	// shouldn't get here
}

// Make some e.g. condition strings more readable by stripping {} " g. and turning : into space
QString FileData::strip_string(const QString& s)
{
	QString t;
	bool nowiki = false;	// used to escape problem characters like || in tables
	cerr << "string is " << s.toLatin1().data() << endl;
	for (int i=0; i<s.length(); i++) {
		switch (s[i].toLatin1()) {
		case '{':
		case '}':
		case '"':
			break;
		case '|':
			nowiki = true;
			t += '|';
			break;
		case ':':
			t += ' ';
			break;
		case ',':
			t += ", ";
			break;
		case 'g':	// skip g.
			if (i < s.length()-1 && s[i+1] == '.')
				++i;
			else
				t += 'g';
			break;
		default:
			t += s[i];
		}
	}
	if (nowiki) return "<nowiki>" + t + "</nowiki>";
	return t;
}

QString FileData::strip_field(const QString &s, const QString& field)
{
	if (!s.contains(field)) return s;

	// The field may be on its own, or at the beginning, middle or end of a list of fields.
	// No single regexp will work unfortunately.
	// The field will be followed by a space and a value
	QString t(s);
	t = t.remove(QRegExp(field + " [0-9]+,* *"));
	t = t.remove(QRegExp(", *$"));
	return t;
}


QString FileData::initial_caps(const QString &s)
{
	QString t(s);
	bool prev_space = true;
	for (int i=0; i<t.length(); i++) {
		if (prev_space && t[i].isLetter()) {
			t[i] = t[i].toUpper();
			prev_space = false;
		}
		else if (t[i].isSpace())
			prev_space = true;
	}
	return t;
}

int FileData::populateSearch(QTextEdit* tbl, const QString& search, QString& html, QString& wiki)
{
	int matches = 0;

	if (json.isObject()) {
		// It's a seasonal file
		// Too complicated for now
		return 0;
	}
	if (!json.isArray()) {
		cerr << name.toLatin1().data() << "dodgy Json format" << endl;
		return 0;
	}

	QString id;
	QString idname;

	// We should have an array of objects, each containing an id
	QJsonArray array = json.array();
	for (auto const i : array) {
		QJsonObject v = i.toObject();
		id = v["id"].toString();
		idname = v["name"].toString();
		for (auto j : v.keys()) {
			QString s = json_lookup(v, j);
			if (s.contains(search, Qt::CaseInsensitive)) {
				// we found a match so add it
				html += "<tr><td>" + name + "<td>" + id + "<td>" + idname + "<td>" + j + "<td>" + highlight_string(s, search) + "</tr>";
				wiki += "|-\n| " + name + " || " + id + " || " + idname + " || " + j + " || " + escape_wiki(highlight_string(s, search)) + "\n";
				++matches;
			}
		}
	}
	return matches;
}

// Highlight found text in red
QString FileData::highlight_string(const QString& s, const QString& search)
{
	int i = s.indexOf(search, 0, Qt::CaseInsensitive);
	if (i == -1) return s;	// shouldn't fail unless we modified the string
	QString t(s);
	t.insert(i + search.length(), "</font>");
	t.insert(i, "<font color=\"red\">");
	return t;
}

// Surround sequences of | with <nowiki> to prevent them being interpreted as column separators in a table
QString FileData::escape_wiki(const QString &s)
{
	if (!s.contains('|')) return s;
	QString t(s);
	return t.replace(QRegExp("(\\|+)"), "<nowiki>\\1</nowiki>");
}
